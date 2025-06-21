import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import pdfMake from "pdfmake/build/pdfmake"; // statischer Import!
import pdfFonts from "pdfmake/build/vfs_fonts";
pdfMake.vfs = pdfFonts.pdfMake.vfs;
//import * as XLSX from "xlsx";                // statischer Import!

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}