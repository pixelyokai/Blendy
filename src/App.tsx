import { useEffect, useState } from "react";
import { Editor } from "./editor/Editor";
import { Header } from "./editor/Header";
import { SadIcon } from "./editor/ui/Icons";
import { track } from "./analytics";

/** Below this the editor is not offered; see the design's mobile notice. */
const MIN_WIDTH = 480;

export function App() {
  const narrow = useNarrow();
  useEffect(() => track("app_opened"), []);

  if (!narrow) return <Editor />;
  return (
    <main className="app">
      <div className="shell mobile">
        <Header />
        <div className="mobile-body">
          <div className="mobile-card">
            <SadIcon />
            <p>We're sorry. Blendy is only available on desktop and laptop devices.</p>
          </div>
        </div>
      </div>
    </main>
  );
}

function useNarrow() {
  const [narrow, setNarrow] = useState(() => innerWidth < MIN_WIDTH);
  useEffect(() => {
    const onResize = () => setNarrow(innerWidth < MIN_WIDTH);
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, []);
  return narrow;
}
