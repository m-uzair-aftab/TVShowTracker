import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

document.title = "TV Show Tracker";
createRoot(document.getElementById("root")!).render(<App />);
