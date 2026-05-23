import { inflateRaw } from "pako";

type NodeId = string;

interface FlowNode {
  id: NodeId;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
 * Convert a draw.io flowchart into a linear Goalway-style script and
 * also return a structured instruction list for mission editing.
 */
export function drawioToLinearIfStages(
  drawioXml: string,
  options: GenerateOptions = {}
): string {
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
    return "START\n\nEND";
  }

  const commonSuffix = findCommonSuffix(allPaths);
  const commonSuffixSet = new Set(commonSuffix);

  const lines: string[] = [];
  lines.push("START");
  lines.push("");

  emitNode(
    graph,
    startNodeId,
    commonSuffixSet,
    lines,
    0,
    formatCondition,
    new Set()
  );

  if (commonSuffix.length > 0) {
    lines.push("");
    for (const nodeId of commonSuffix) {
      const node = graph.nodes.get(nodeId);
      if (node) {
        lines.push(node.text);
      }
    }
  }

  lines.push("");
  lines.push("END");

  return trimEmptyLines(lines).join("\n");
}

/**
 * Parse a draw.io XML string (plain or compressed) and convert it
 * into a flat list of mission instruction tuples plus a preview string.
 */
export function drawioToMissionInstructions(
  drawioXml: string,
  options: GenerateOptions = {}
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

  const tempCounter = { value: 1 };
  const instructionList: Array<[string, string?]> = [];

  emitNodeWithInstructions(
    graph,
    startNodeId,
    commonSuffixSet,
    lines,
    0,
    formatCondition,
    new Set(),
    instructionList,
    tempCounter
  );

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

  return { instructions: instructionList, linearText: trimEmptyLines(lines).join("\n") };
}

// ---------------------------------------------------------------------------
// XML extraction and graph parsing
// ---------------------------------------------------------------------------

function extractMxGraphXml(drawioXml: string): string {
  if (drawioXml.includes("<mxGraphModel")) {
    return drawioXml;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(drawioXml, "text/xml");

  const diagram = doc.querySelector("diagram");
  if (!diagram) {
    throw new Error("No <diagram> or <mxGraphModel> found in draw.io XML.");
  }

  const diagramText = (diagram.textContent ?? "").trim();

  if (diagramText.startsWith("<mxGraphModel")) {
    return diagramText;
  }

  // draw.io compressed format: base64 → raw deflate → URI-decoded XML
  try {
    const binary = base64ToUint8Array(diagramText);
    const inflated = inflateRaw(binary, { to: "string" }) as string;
    return decodeURIComponent(inflated);
  } catch {
    throw new Error(
      "Could not decode compressed draw.io diagram. Make sure pako is installed and the file is valid."
    );
  }
}

function parseMxGraphModel(mxGraphXml: string): FlowGraph {
  const parser = new DOMParser();
  const doc = parser.parseFromString(mxGraphXml, "text/xml");

  const cells = Array.from(doc.querySelectorAll("mxCell"));
  const cellById = new Map<string, Element>();

  for (const cell of cells) {
    const id = cell.getAttribute("id");
    if (id) {
      cellById.set(id, cell);
    }
  }

  const nodes = new Map<NodeId, FlowNode>();
  const edgeLabels = collectEdgeLabels(cells);

  // Collect real flowchart nodes (exclude draw.io edge-label cells)
  for (const cell of cells) {
    const id = cell.getAttribute("id") ?? "";
    const value = cleanDrawioText(cell.getAttribute("value") ?? "");
    const isVertex = cell.getAttribute("vertex") === "1";

    if (!isVertex || isEdgeLabelCell(cell, cellById)) {
      continue;
    }

    const geometry = getDirectGeometry(cell);

    nodes.set(id, {
      id,
      text: value || `[node ${id}]`,
      x: Number(geometry?.getAttribute("x") ?? 0),
      y: Number(geometry?.getAttribute("y") ?? 0),
      width: Number(geometry?.getAttribute("width") ?? 0),
      height: Number(geometry?.getAttribute("height") ?? 0),
    });
  }

  const edges: FlowEdge[] = [];

  // Collect edges; infer missing targets from targetPoint coordinates
  for (const cell of cells) {
    const id = cell.getAttribute("id") ?? "";
    const isEdge = cell.getAttribute("edge") === "1";

    if (!isEdge) {
      continue;
    }

    const source = cell.getAttribute("source");
    const explicitTarget = cell.getAttribute("target");
    const inferredTarget =
      explicitTarget ?? inferTargetNodeId(cell, nodes, source ?? undefined);
    const label =
      cleanDrawioText(cell.getAttribute("value") ?? "") ||
      edgeLabels.get(id) ||
      "";

    if (source && inferredTarget) {
      edges.push({
        id,
        source,
        target: inferredTarget,
        label: normalizeLabel(label),
      });
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

  // Auto-fill missing כן/לא when a junction has two branches and only one is labeled
  completeMissingYesNoLabels(outgoing);

  for (const [nodeId, list] of outgoing.entries()) {
    list.sort((a, b) =>
      compareEdges(graphNode(nodes, a.target), graphNode(nodes, b.target), a, b)
    );
    outgoing.set(nodeId, list);
  }

  return { nodes, edges, outgoing, incoming };
}

// ---------------------------------------------------------------------------
// emitNode — pure linear text output (used by drawioToLinearIfStages)
// ---------------------------------------------------------------------------

function emitNode(
  graph: FlowGraph,
  nodeId: NodeId,
  commonSuffixSet: Set<NodeId>,
  lines: string[],
  indentLevel: number,
  formatCondition: (junctionText: string, edgeLabel: string) => string,
  visitedInCurrentPath: Set<NodeId>
): void {
  if (commonSuffixSet.has(nodeId)) return;

  if (visitedInCurrentPath.has(nodeId)) {
    lines.push(
      `${indent(indentLevel)}-- cycle detected at ${
        graph.nodes.get(nodeId)?.text ?? nodeId
      }`
    );
    return;
  }

  const node = graph.nodes.get(nodeId);
  if (!node) return;

  const nextEdges = graph.outgoing.get(nodeId) ?? [];
  visitedInCurrentPath.add(nodeId);

  if (nextEdges.length === 0) {
    lines.push(`${indent(indentLevel)}${node.text}`);
    visitedInCurrentPath.delete(nodeId);
    return;
  }

  if (nextEdges.length === 1) {
    lines.push(`${indent(indentLevel)}${node.text}`);
    emitNode(
      graph,
      nextEdges[0].target,
      commonSuffixSet,
      lines,
      indentLevel,
      formatCondition,
      new Set(visitedInCurrentPath)
    );
    visitedInCurrentPath.delete(nodeId);
    return;
  }

  // Junction — emit IF / END-IF blocks, skip empty branches
  for (const edge of nextEdges) {
    const conditionText = formatCondition(node.text, edge.label);
    const branchLines: string[] = [];

    emitNode(
      graph,
      edge.target,
      commonSuffixSet,
      branchLines,
      indentLevel + 1,
      formatCondition,
      new Set(visitedInCurrentPath)
    );

    const cleanedBranchLines = trimEmptyLines(branchLines).filter(
      (line) => line.trim() !== ""
    );

    if (cleanedBranchLines.length === 0) {
      continue;
    }

    lines.push(`${indent(indentLevel)}IF ${conditionText}`);
    lines.push(...cleanedBranchLines);
    lines.push(`${indent(indentLevel)}END IF`);
    lines.push("");
  }

  visitedInCurrentPath.delete(nodeId);
}

// ---------------------------------------------------------------------------
// emitNodeWithInstructions — same traversal but also builds instruction tuples
// ---------------------------------------------------------------------------

function emitNodeWithInstructions(
  graph: FlowGraph,
  nodeId: NodeId,
  commonSuffixSet: Set<NodeId>,
  lines: string[],
  indentLevel: number,
  formatCondition: (junctionText: string, edgeLabel: string) => string,
  visitedInCurrentPath: Set<NodeId>,
  instructionList: Array<[string, string?]>,
  tempCounter: { value: number }
): void {
  if (commonSuffixSet.has(nodeId)) return;

  if (visitedInCurrentPath.has(nodeId)) {
    lines.push(
      `${indent(indentLevel)}-- cycle detected at ${
        graph.nodes.get(nodeId)?.text ?? nodeId
      }`
    );
    return;
  }

  const node = graph.nodes.get(nodeId);
  if (!node) return;

  const nextEdges = graph.outgoing.get(nodeId) ?? [];
  visitedInCurrentPath.add(nodeId);

  if (nextEdges.length === 0) {
    lines.push(`${indent(indentLevel)}${node.text}`);
    instructionList.push([`T${tempCounter.value++}`, node.text]);
    visitedInCurrentPath.delete(nodeId);
    return;
  }

  if (nextEdges.length === 1) {
    lines.push(`${indent(indentLevel)}${node.text}`);
    instructionList.push([`T${tempCounter.value++}`, node.text]);
    emitNodeWithInstructions(
      graph,
      nextEdges[0].target,
      commonSuffixSet,
      lines,
      indentLevel,
      formatCondition,
      new Set(visitedInCurrentPath),
      instructionList,
      tempCounter
    );
    visitedInCurrentPath.delete(nodeId);
    return;
  }

  // Junction — emit IF / END-IF blocks, skip empty branches
  for (const edge of nextEdges) {
    const conditionText = formatCondition(node.text, edge.label);
    const branchLines: string[] = [];
    const branchInstructions: Array<[string, string?]> = [];

    emitNodeWithInstructions(
      graph,
      edge.target,
      commonSuffixSet,
      branchLines,
      indentLevel + 1,
      formatCondition,
      new Set(visitedInCurrentPath),
      branchInstructions,
      tempCounter
    );

    const cleanedBranchLines = trimEmptyLines(branchLines).filter(
      (line) => line.trim() !== ""
    );

    if (cleanedBranchLines.length === 0) {
      continue;
    }

    const ifId = `if-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const endIfId = `end-if-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    lines.push(`${indent(indentLevel)}IF ${conditionText}`);
    lines.push(...cleanedBranchLines);
    lines.push(`${indent(indentLevel)}END IF`);
    lines.push("");

    instructionList.push([ifId, conditionText]);
    instructionList.push(...branchInstructions);
    instructionList.push([endIfId]);
  }

  visitedInCurrentPath.delete(nodeId);
}

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

function findStartNode(graph: FlowGraph): NodeId {
  const candidates = Array.from(graph.nodes.values()).filter((node) => {
    const incoming = graph.incoming.get(node.id) ?? [];
    return incoming.length === 0;
  });

  if (candidates.length === 0) {
    throw new Error(
      "Could not find a start node. The graph may contain a cycle."
    );
  }

  candidates.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  return candidates[0].id;
}

function findAllNodePaths(graph: FlowGraph, startNodeId: NodeId): NodeId[][] {
  const result: NodeId[][] = [];

  function dfs(
    nodeId: NodeId,
    path: NodeId[],
    visited: Set<NodeId>
  ): void {
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

/**
 * Finds node IDs that are common at the end of all paths.
 * Example:
 *   path 1: A B C Z
 *   path 2: A D E Z
 *   common suffix: [Z]
 */
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

// ---------------------------------------------------------------------------
// Edge label helpers
// ---------------------------------------------------------------------------

/**
 * Collect edge labels stored as child mxCell elements with edgeLabel style.
 * In some draw.io exports, the label is a separate vertex child of the edge.
 */
function collectEdgeLabels(cells: Element[]): Map<string, string> {
  const edgeLabels = new Map<string, string>();

  for (const cell of cells) {
    const parent = cell.getAttribute("parent");
    const style = cell.getAttribute("style") ?? "";
    const value = cleanDrawioText(cell.getAttribute("value") ?? "");

    if (parent && value && style.includes("edgeLabel")) {
      edgeLabels.set(parent, normalizeLabel(value));
    }
  }

  return edgeLabels;
}

/**
 * Returns true if the cell is a draw.io edge-label pseudo-vertex
 * (should be excluded from real flowchart nodes).
 */
function isEdgeLabelCell(
  cell: Element,
  cellById: Map<string, Element>
): boolean {
  const style = cell.getAttribute("style") ?? "";
  const parentId = cell.getAttribute("parent");
  const parent = parentId ? cellById.get(parentId) : undefined;

  return (
    style.includes("edgeLabel") || parent?.getAttribute("edge") === "1"
  );
}

/**
 * Infer the target node of an edge by matching the edge's targetPoint
 * coordinates to the closest real node.
 */
function inferTargetNodeId(
  edgeCell: Element,
  nodes: Map<NodeId, FlowNode>,
  sourceNodeId?: string
): NodeId | undefined {
  const targetPoint = getPoint(edgeCell, "targetPoint");
  if (!targetPoint) return undefined;

  const pointMargin = 12;
  const candidates = Array.from(nodes.values()).filter(
    (node) => node.id !== sourceNodeId
  );

  const containingNode = candidates.find(
    (node) =>
      targetPoint.x >= node.x - pointMargin &&
      targetPoint.x <= node.x + node.width + pointMargin &&
      targetPoint.y >= node.y - pointMargin &&
      targetPoint.y <= node.y + node.height + pointMargin
  );

  if (containingNode) return containingNode.id;

  const nearest = candidates
    .map((node) => ({
      node,
      distance: distanceToNode(targetPoint.x, targetPoint.y, node),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  return nearest && nearest.distance <= 80 ? nearest.node.id : undefined;
}

function getPoint(
  cell: Element,
  pointName: string
): { x: number; y: number } | undefined {
  const geometry = getDirectGeometry(cell);
  if (!geometry) return undefined;

  const points = Array.from(geometry.querySelectorAll("mxPoint"));
  const point = points.find(
    (candidate) => candidate.getAttribute("as") === pointName
  );

  if (!point) return undefined;

  const x = Number(point.getAttribute("x"));
  const y = Number(point.getAttribute("y"));

  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;

  return { x, y };
}

function getDirectGeometry(cell: Element): Element | undefined {
  return Array.from(cell.children).find(
    (child) => child.tagName === "mxGeometry"
  );
}

/**
 * When a junction has exactly two outgoing edges and only one is labeled
 * כן or לא, automatically assign the complementary label to the other.
 */
function completeMissingYesNoLabels(
  outgoing: Map<NodeId, FlowEdge[]>
): void {
  for (const edges of outgoing.values()) {
    if (edges.length !== 2) continue;

    const labels = edges.map((edge) => normalizeLabel(edge.label));
    const blankIndex = labels.findIndex((label) => label === "");

    if (blankIndex === -1) continue;

    const otherLabel = labels[1 - blankIndex];

    if (otherLabel === "כן") {
      edges[blankIndex].label = "לא";
    } else if (otherLabel === "לא") {
      edges[blankIndex].label = "כן";
    }
  }
}

function distanceToNode(x: number, y: number, node: FlowNode): number {
  const closestX = Math.max(node.x, Math.min(x, node.x + node.width));
  const closestY = Math.max(node.y, Math.min(y, node.y + node.height));
  const dx = x - closestX;
  const dy = y - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

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

/** Normalize edge labels: canonicalize yes/no → כן/לא */
function normalizeLabel(label: string): string {
  const clean = cleanDrawioText(label).replace(/\s+/g, " ").trim();

  if (clean.toLowerCase() === "yes") return "כן";
  if (clean.toLowerCase() === "no") return "לא";

  return clean;
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

function graphNode(
  nodes: Map<NodeId, FlowNode>,
  id: NodeId
): FlowNode | undefined {
  return nodes.get(id);
}

function compareEdges(
  targetA: FlowNode | undefined,
  targetB: FlowNode | undefined,
  edgeA: FlowEdge,
  edgeB: FlowEdge
): number {
  const byLabel = labelOrder(edgeA.label) - labelOrder(edgeB.label);
  if (byLabel !== 0) return byLabel;

  if (targetA && targetB) {
    if (targetA.y !== targetB.y) return targetA.y - targetB.y;
    return targetA.x - targetB.x;
  }

  return edgeA.id.localeCompare(edgeB.id);
}

function labelOrder(label: string): number {
  const clean = normalizeLabel(label);
  if (clean === "כן") return 0;
  if (clean === "לא") return 1;
  return 2;
}

function trimEmptyLines(lines: string[]): string[] {
  const result: string[] = [];

  for (const line of lines) {
    const previous = result[result.length - 1];
    if (line === "" && previous === "") {
      continue;
    }
    result.push(line);
  }

  return result;
}
