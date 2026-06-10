// Must run before anything that issues API requests.
import "./lib/api-base";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
