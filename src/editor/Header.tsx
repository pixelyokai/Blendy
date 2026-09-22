import { useUi } from "../state/uiStore";
import { GitHubLogo, XLogo } from "./ui/Icons";

const LINKS = {
  x: "https://x.com/pixelyokai",
  github: "https://github.com/pixelyokai/blendy",
};

/** Wordmark and social links; shared by the editor and the small-screen notice. */
export function Header() {
  const theme = useUi((s) => s.theme);
  return (
    <header className="header">
      <img className="logo" src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"} alt="Blendy" width={120} height={30} />
      <nav className="header-links">
        <a className="icon-btn link-btn" href={LINKS.x} target="_blank" rel="noreferrer" aria-label="Blendy on X" data-tip="Blendy on X">
          <XLogo />
        </a>
        <a className="icon-btn link-btn" href={LINKS.github} target="_blank" rel="noreferrer" aria-label="Source on GitHub" data-tip="Source on GitHub">
          <GitHubLogo />
        </a>
      </nav>
    </header>
  );
}
