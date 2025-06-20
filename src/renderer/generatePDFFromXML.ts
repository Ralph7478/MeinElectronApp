import pdfMake from "pdfmake/build/pdfmake";
import "pdfmake/build/vfs_fonts";

// Hilfsfunktionen
export function formatEuro(value: string | number): string {
  let num = parseFloat(String(value).replace(',', '.'));
  if (isNaN(num)) num = 0;
  return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatGermanDateTime(dateString: string | Date): string {
  let date = typeof dateString === "string" ? new Date(dateString) : dateString;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    pad(date.getDate()) + '.' +
    pad(date.getMonth() + 1) + '.' +
    date.getFullYear() + ' ' +
    pad(date.getHours()) + ':' +
    pad(date.getMinutes()) + ':' +
    pad(date.getSeconds())
  );
}

export function formatGermanDate(dateString: string | Date): string {
  let date = typeof dateString === "string" ? new Date(dateString) : dateString;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    pad(date.getDate()) + '.' +
    pad(date.getMonth() + 1) + '.' +
    date.getFullYear()
  );
}

export function splitVerwendungszweck(text: string): string {
  if (!text) return "";
  text = text.slice(0, 140);
  if (text.length <= 70) return text;
  let idx = text.lastIndexOf(' ', 70);
  if (idx === -1) idx = 70;
  return text.slice(0, idx) + '\n' + text.slice(idx).trim();
}

export function getXMLText(parent: Element | null, tag: string): string {
  if (!parent) return "";
  const el = parent.getElementsByTagName(tag)[0];
  return el ? el.textContent || "" : "";
}

export function generatePDFFromXML(xmlDoc: Document): void {
  if (!xmlDoc) {
    alert('Bitte XML-Datei zuerst laden.');
    return;
  }

  // HEADER-DATEN aus XML extrahieren
  const grpHdr = xmlDoc.getElementsByTagName("GrpHdr")[0];
  const msgId = getXMLText(grpHdr, "MsgId");
  const creDtTm = getXMLText(grpHdr, "CreDtTm");
  // Payment Information
  const pmtInf = xmlDoc.getElementsByTagName("PmtInf")[0];
  const nbOfTxs = getXMLText(pmtInf, "NbOfTxs");
  const ctrlSum = getXMLText(pmtInf, "CtrlSum");
  const reqdExctnDt = getXMLText(pmtInf, "ReqdExctnDt");

  // Auftraggeberdaten
  const dbtr = pmtInf.getElementsByTagName("Dbtr")[0];
  const auftraggeberName = getXMLText(dbtr, "Nm");

  const dbtrAcct = pmtInf.getElementsByTagName("DbtrAcct")[0];
  const auftraggeberIBAN = getXMLText(dbtrAcct, "IBAN");

  const dbtrAgt = pmtInf.getElementsByTagName("DbtrAgt")[0];
  const auftraggeberBIC = getXMLText(dbtrAgt, "BICFI");

  // TRANSAKTIONEN extrahieren
  const txList = Array.from(xmlDoc.getElementsByTagName("CdtTrfTxInf"));

  // SUMME und ANZAHL
  let summe = 0;
  txList.forEach(tx => {
    const betrag = getXMLText(tx, "InstdAmt");
    const betragNum = parseFloat(String(betrag).replace(',', '.'));
    summe += (isNaN(betragNum) ? 0 : betragNum);
  });

  // HEADER wie in generatePDF
  const header = [
    { text: 'Erfassungsprotokoll: Zahlung', style: 'header', margin: [0, 0, 0, 5] },
    { text: `Sammler: ${msgId}`, style: 'subheader', margin: [0, 0, 0, 1] },
    { text: `Erfassung: ${creDtTm ? formatGermanDateTime(creDtTm) : formatGermanDateTime(new Date())}`, style: 'subheader', margin: [0, 0, 0, 1] },
    { text: `Valuta: ${reqdExctnDt ? formatGermanDate(reqdExctnDt) : formatGermanDate(new Date())}`, style: 'valuta', margin: [0, 0, 0, 1] },
    { text: `Auftraggeber: ${auftraggeberName || ''}`, style: 'meta', margin: [0, 0, 0, 1] },
    { text: `IBAN: ${auftraggeberIBAN || ''}`, style: 'meta', margin: [0, 0, 0, 1] },
    { text: `BIC: ${auftraggeberBIC || ''}`, style: 'meta', margin: [0, 0, 0, 1] },
    { text: `Summe: ${formatEuro(summe)} EUR   •   Überweisungen: ${txList.length}`, style: 'meta', margin: [0, 0, 0, 8] }
  ];

  // TABELLENAUFBAU wie in generatePDF
  const tableBody: any[] = [
    [
      { text: 'Nr.', style: 'tableHeader' },
      { text: 'Empfänger', style: 'tableHeader' },
      { text: 'IBAN', style: 'tableHeader' },
      { text: 'Verwendungszweck', style: 'tableHeader' },
      { text: 'EndToEndId', style: 'tableHeader' },
      { text: 'Betrag', style: 'tableHeader', alignment: 'right', margin: [0,0,12,0]  }
    ]
  ];

  txList.forEach((tx, i) => {
    const empfaenger = getXMLText(tx.getElementsByTagName("Cdtr")[0], "Nm");
    const iban = getXMLText(tx.getElementsByTagName("CdtrAcct")[0], "IBAN");
    const bic = getXMLText(
      tx.getElementsByTagName("CdtrAgt")[0]?.getElementsByTagName("FinInstnId")[0],
      "BICFI"
    );
    const vwz = getXMLText(tx.getElementsByTagName("RmtInf")[0], "Ustrd");
    const endToEndId = getXMLText(tx.getElementsByTagName("PmtId")[0], "EndToEndId");
    const betrag = getXMLText(tx, "InstdAmt");

    tableBody.push([
      { text: (i + 1).toString(), style: 'tableCell' },
      { text: empfaenger, style: 'tableCell' },
      { text: bic ? (iban + '\n' + bic) : iban, style: 'tableCell' },
      { text: splitVerwendungszweck(vwz), style: 'vwzCell' },
      { text: endToEndId, style: 'tableCell' },
      { text: formatEuro(betrag), style: 'tableCell', alignment: 'right', margin: [0,0,12,0] }
    ]);
  });

  // SUMMENZEILE wie in generatePDF
  tableBody.push([
    { text: '', style: 'tableCell' },
    { text: '', style: 'tableCell' },
    { text: '', style: 'tableCell' },
    { text: '', style: 'tableCell' },
    { text: 'Summe:', style: 'tableHeader', alignment: 'right' },
    { text: formatEuro(summe), style: 'tableHeader', alignment: 'right', margin: [0,0,12,0] }
  ]);

  // PDF GENERIEREN wie in generatePDF
  const docDefinition: any = {
    pageOrientation: 'landscape',
    pageSize: 'A4',
    pageMargins: [18, 14, 18, 25],
    footer: function(currentPage: number, pageCount: number) {
      const now = new Date();
      return {
        columns: [
          { text: `Erstellt: ${formatGermanDateTime(now)}`, alignment: 'left', fontSize: 7, margin: [4, 0, 0, 0] },
          { text: `Datei: Erfassungsprotokoll_${msgId || 'AUS_XML'}.pdf`, alignment: 'center', fontSize: 7 },
          { text: `Seite ${currentPage} von ${pageCount}`, alignment: 'right', fontSize: 7, margin: [0, 0, 4, 0] }
        ],
        margin: [18, 0, 18, 0]
      };
    },
    content: [
      ...header,
      {
        table: {
          headerRows: 1,
          widths: [22, 95, 110, 254, 140, 101],
          body: tableBody
        },
        layout: 'lightHorizontalLines'
      }
    ],
    styles: {
      header: { fontSize: 12, bold: true },
      subheader: { fontSize: 9, bold: false },
      valuta: { fontSize: 8, bold: true },
      meta: { fontSize: 8, color: '#555' },
      tableHeader: { bold: true, fillColor: '#eeeeee', fontSize: 9 },
      tableCell: { fontSize: 8 },
      vwzCell: { fontSize: 8, lineHeight: 1.1 }
    }
  };

  pdfMake.createPdf(docDefinition).download(`Erfassungsprotokoll_${msgId || 'AUS_XML'}.pdf`);
}