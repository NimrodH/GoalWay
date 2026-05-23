import { inflateRaw } from "pako";

type NodeId = string;

interface FlowNode {
  id: NodeId;
  text: string;
  x: number;
  y: number;
}

interface FlowEdge {
  id: string;
  source: NodeId;
  target: NodeId;
  label: string;
}

interface FlowGraph {
  nodes: Map<NodeId, FlowNode>;
  edges: FlowEdge[];
  outgoing: Map<NodeId, FlowEdge[]>;
  incoming: Map<NodeId, FlowEdge[]>;
}

interface GenerateOptions {
  startNodeId?: string;
  /**
   * Convert a junction node + edge label into IF text.
   * Example:
   *   junctionText = "מוצר נמצא?"
   *   edgeLabel    = "לא"
   *   returns        "מוצר נמצא? = לא"
   */
  formatCondition?: (junctionText: string, edgeLabel: string) => string;
}

/**
 * Result of parsing a draw.io flowchart into a mission instruction list.
 *
 * Each entry is a tuple compatible with the `Mission.instructions` array:
 *   [id, optionalTitle?]
 *
 * Special ids produced:
 *   - "T1", "T2", … — temp placeholder steps (node text becomes the title)
 *   - "if-<uuid>"    — IF condition block  (text is the condition)
 *   - "end-if-<uuid>"— END-IF marker
 */
export interface DrawioParseResult {
  /** Instruction tuples ready to spread into `selectedInstructions` */
  instructions: Array<[string, string?]>;
  /** Human-readable linear representation (for preview / debugging) */
  linearText: string;
}

/**
 * Parse a draw.io XML string (plain or compressed) and convert it
 * into a flat list of mission instruction tuples.
 */
export function drawioToMissionInstructions(
  drawioXml: string,
  options: GenerateOptions = {},
): DrawioParseResult {
  const mxGraphXml = extractMxGraphXml(drawioXml);
  const graph = parseMxGraphModel(mxGraphXml);

  const startNodeId = options.startNodeId ?? findStartNode(graph);
  const formatCondition =
    options.formatCondition ??
    ((junctionText: string, edgeLabel: string) => {
      if (edgeLabel.trim()) return `${junctionText} = ${edgeLabel}`;
      return junctionText;
    });

  const allPaths = findAllNodePaths(graph, startNodeId);

  if (allPaths.length === 0) {
    return { instructions: [], linearText: "START\n\nEND" };
  }

  const commonSuffix = findCommonSuffix(allPaths);
  const commonSuffixSet = new Set(commonSuffix);

  const lines: string[] = [];
  lines.push("START");
  lines.push("");

  // State shared across emitNode calls
  const tempCounter = { value: 1 };
  const instructionList: Array<[string, string?]> = [];

  emitNode(
    graph,
    startNodeId,
    commonSuffixSet,
    lines,
    0,
    formatCondition,
    new Set(),
    instructionList,
    tempCounter,
  );

  // Emit the common-suffix (convergence) nodes
  if (commonSuffix.length > 0) {
    lines.push("");
    for (const nodeId of commonSuffix) {
      const node = graph.nodes.get(nodeId);
      if (node) {
        lines.push(node.text);
        const tempId = `T${tempCounter.value++}`;
        instructionList.push([tempId, node.text]);
      }
    }
  }

  lines.push("");
  lines.push("END");

  return { instructions: instructionList, linearText: lines.join("\n") };
}

// ---------------------------------------------------------------------------
// Internal helpers (ported from the original flowchart2goalway.ts)
// ---------------------------------------------------------------------------

function extractMxGraphXml(drawioXml: string): string {
  if (drawioXml.includes("<mxGraphModel")) return drawioXml;

  const parser = new DOMParser();
  const doc = parser.parseFromString(drawioXml, "text/xml");

  const diagram = doc.querySelector("diagram");
  if (!diagram) {
    throw new Error("No <diagram> or <mxGraphModel> found in draw.io XML.");
  }

  const diagramText = (diagram.textContent ?? "").trim();

  if (diagramText.startsWith("<mxGraphModel")) return diagramText;

  // Compressed format: base64 → raw deflate → URI-decoded XML
  try {
    const binary = base64ToUint8Array(diagramText);
    const inflated = inflateRaw(binary, { to: "string" }) as string;
    return decodeURIComponent(inflated);
  } catch {
    throw new Error(
      "Could not decode compressed draw.io diagram. Make sure pako is installed and the file is valid.",
    );
  }
}

function parseMxGraphModel(mxGraphXml: string): FlowGraph {
  const parser = new DOMParser();
  const doc = parser.parseFromString(mxGraphXml, "text/xml");

  const cells = Array.from(doc.querySelectorAll("mxCell"));

  const nodes = new Map<NodeId, FlowNode>();
  const edges: FlowEdge[] = [];

  for (const cell of cells) {
    const id = cell.getAttribute("id") ?? "";
    const value = cleanDrawioText(cell.getAttribute("value") ?? "");
    const isVertex = cell.getAttribute("vertex") === "1";
    const isEdge = cell.getAttribute("edge") === "1";

    if (isVertex) {
      const geometry = cell.querySelector("mxGeometry");
      nodes.set(id, {
        id,
        text: value || `[node ${id}]`,
        x: Number(geometry?.getAttribute("x") ?? 0),
        y: Number(geometry?.getAttribute("y") ?? 0),
      });
    }

    if (isEdge) {
      const source = cell.getAttribute("source");
      const target = cell.getAttribute("target");
      if (source && target) {
        edges.push({ id, source, target, label: value });
      }
    }
  }

  const outgoing = new Map<NodeId, FlowEdge[]>();
  const incoming = new Map<NodeId, FlowEdge[]>();

  for (const nodeId of nodes.keys()) {
    outgoing.set(nodeId, []);
    incoming.set(nodeId, []);
  }

  for (const edge of edges) {
    outgoing.get(edge.source)?.push(edge);
    incoming.get(edge.target)?.push(edge);
  }

  for (const [nodeId, list] of outgoing.entries()) {
    list.sort((a, b) =>
      compareEdges(nodes.get(a.target), nodes.get(b.target), a, b),
    );
    outgoing.set(nodeId, list);
  }

  return { nodes, edges, outgoing, incoming };
}

function emitNode(
  graph: FlowGraph,
  nodeId: NodeId,
  commonSuffixSet: Set<NodeId>,
  lines: string[],
  indentLevel: number,
  formatCondition: (junctionText: string, edgeLabel: string) => string,
  visitedInCurrentPath: Set<NodeId>,
  instructionList: Array<[string, string?]>,
  tempCounter: { value: number },
): void {
  if (commonSuffixSet.has(nodeId)) return;
  if (visitedInCurrentPath.has(nodeId)) {
    lines.push(`${indent(indentLevel)}-- cycle detected at ${graph.nodes.get(nodeId)?.text ?? nodeId}`);
    return;
  }

  const node = graph.nodes.get(nodeId);
  if (!node) return;

  const nextEdges = graph.outgoing.get(nodeId) ?? [];
  visitedInCurrentPath.add(nodeId);

  if (nextEdges.length === 0) {
    // Leaf node
    lines.push(`${indent(indentLevel)}${node.text}`);
    const tempId = `T${tempCounter.value++}`;
    instructionList.push([tempId, node.text]);
    visitedInCurrentPath.delete(nodeId);
    return;
  }

  if (nextEdges.length === 1) {
    // Linear node
    lines.push(`${indent(indentLevel)}${node.text}`);
    const tempId = `T${tempCounter.value++}`;
    instructionList.push([tempId, node.text]);

    emitNode(
      graph,
      nextEdges[0].target,
      commonSuffixSet,
      lines,
      indentLevel,
      formatCondition,
      new Set(visitedInCurrentPath),
      instructionList,
      tempCounter,
    );
    visitedInCurrentPath.delete(nodeId);
    return;
  }

  // Junction node — emit IF / END-IF branches
  for (const edge of nextEdges) {
    const conditionText = formatCondition(node.text, edge.label);
    const ifId = `if-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const endIfId = `end-if-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    lines.push(`${indent(indentLevel)}IF ${conditionText}`);
    instructionList.push([ifId, conditionText]);

    emitNode(
      graph,
      edge.target,
      commonSuffixSet,
      lines,
      indentLevel + 1,
      formatCondition,
      new Set(visitedInCurrentPath),
      instructionList,
      tempCounter,
    );

    lines.push(`${indent(indentLevel)}END IF`);
    instructionList.push([endIfId]);
    lines.push("");
  }

  visitedInCurrentPath.delete(nodeId);
}

function findStartNode(graph: FlowGraph): NodeId {
  const candidates = Array.from(graph.nodes.values()).filter((node) => {
    const inc = graph.incoming.get(node.id) ?? [];
    return inc.length === 0;
  });

  if (candidates.length === 0) {
    throw new Error("Could not find a start node. The graph may contain a cycle.");
  }

  candidates.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  return candidates[0].id;
}

function findAllNodePaths(graph: FlowGraph, startNodeId: NodeId): NodeId[][] {
  const result: NodeId[][] = [];

  function dfs(nodeId: NodeId, path: NodeId[], visited: Set<NodeId>): void {
    if (visited.has(nodeId)) return;

    const newPath = [...path, nodeId];
    const outgoing = graph.outgoing.get(nodeId) ?? [];

    if (outgoing.length === 0) {
      result.push(newPath);
      return;
    }

    const newVisited = new Set(visited);
    newVisited.add(nodeId);
    for (const edge of outgoing) {
      dfs(edge.target, newPath, newVisited);
    }
  }

  dfs(startNodeId, [], new Set());
  return result;
}

function findCommonSuffix(paths: NodeId[][]): NodeId[] {
  if (paths.length === 0) return [];

  const reversed = paths.map((path) => [...path].reverse());
  const common: NodeId[] = [];
  const shortestLength = Math.min(...reversed.map((path) => path.length));

  for (let i = 0; i < shortestLength; i++) {
    const candidate = reversed[0][i];
    if (!reversed.every((path) => path[i] === candidate)) break;
    common.push(candidate);
  }

  return common.reverse();
}

function cleanDrawioText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, `"`)
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .trim();
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary =
    typeof atob !== "undefined"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary");

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function indent(level: number): string {
  return "    ".repeat(level);
}

function compareEdges(
  targetA: FlowNode | undefined,
  targetB: FlowNode | undefined,
  edgeA: FlowEdge,
  edgeB: FlowEdge,
): number {
  const labelOrder = (label: string): number => {
    const clean = label.trim();
    if (clean === "כן" || clean.toLowerCase() === "yes") return 0;
    if (clean === "לא" || clean.toLowerCase() === "no") return 1;
    return 2;
  };

  const byLabel = labelOrder(edgeA.label) - labelOrder(edgeB.label);
  if (byLabel !== 0) return byLabel;

  if (targetA && targetB) {
    if (targetA.y !== targetB.y) return targetA.y - targetB.y;
    return targetA.x - targetB.x;
  }

  return edgeA.id.localeCompare(edgeB.id);
}
