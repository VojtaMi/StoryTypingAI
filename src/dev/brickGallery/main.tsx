import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../index.css";
import BrickGallery from "./BrickGallery";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
	<StrictMode>
		<BrickGallery />
	</StrictMode>,
);
