import { useNavigate } from "react-router";
import styles from "./language-select.module.css";

interface LanguageSelectProps {
  currentLang: "en" | "he";
}

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸", path: "/" },
  { code: "he", label: "עברית", flag: "🇮🇱", path: "/he" },
] as const;

export default function LanguageSelect({ currentLang }: LanguageSelectProps) {
  const navigate = useNavigate();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = LANGUAGES.find((l) => l.code === e.target.value);
    if (selected) navigate(selected.path);
  }

  const current = LANGUAGES.find((l) => l.code === currentLang)!;

  return (
    <div className={styles.wrapper}>
      <span className={styles.flag}>{current.flag}</span>
      <select className={styles.select} value={currentLang} onChange={handleChange}>
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
