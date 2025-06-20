import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import pdfMake from "pdfmake/build/pdfmake"; // statischer Import!
import * as XLSX from "xlsx";                // statischer Import!

ReactDOM.render(<App />, document.getElementById("root"));