import pdfMake from "pdfmake/build/pdfmake";
import "pdfmake/build/vfs_fonts";

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

type WorkbookRow = {
  Empfaenger?: string;
  IBAN?: string;
  BIC?: string;
  Verwendungszweck?: string;
  EndToEndId?: string;
  Betrag?: string | number;
  Valuta?: string;
};

type ConfigData = {
  MSGID?: string;
  AuftraggeberName?: string;
  AuftraggeberIBAN?: string;
  AuftraggeberBIC?: string;
};

export function generatePDF(
  workbookData: WorkbookRow[],
  configData: ConfigData,
  totalAmount: number
): void {
  if (!workbookData || !configData) {
    alert('Bitte Excel-Datei zuerst laden.');
    return;
  }

  const msgId = configData.MSGID || '';
  const creDtTm = new Date();
  const valutaDate = (workbookData[0] && workbookData[0].Valuta)
    ? formatGermanDate(workbookData[0].Valuta!)
    : formatGermanDate(new Date());

  const header = [
    { text: 'Erfassungsprotokoll: Zahlung', style: 'header', margin: [0, 0, 0, 5] },
    { text: `Sammler: ${msgId}`, style: 'subheader', margin: [0, 0, 0, 1] },
    { text: `Erfassung: ${formatGermanDateTime(creDtTm)}`, style: 'subheader', margin: [0, 0, 0, 1] },
    { text: `Valuta: ${valutaDate}`, style: 'valuta', margin: [0, 0, 0, 1] },
    { text: `Auftraggeber: ${configData.AuftraggeberName || ''}`, style: 'meta', margin: [0, 0, 0, 1] },
    { text: `IBAN: ${configData.AuftraggeberIBAN || ''}`, style: 'meta', margin: [0, 0, 0, 1] },
    { text: `BIC: ${configData.AuftraggeberBIC || ''}`, style: 'meta', margin: [0, 0, 0, 1] },
    { text: `Summe: ${formatEuro(totalAmount)} EUR   •   Überweisungen: ${workbookData.length}`, style: 'meta', margin: [0, 0, 0, 8] }
  ];

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

  workbookData.forEach((row, i) => {
    tableBody.push([
      { text: (i + 1).toString(), style: 'tableCell' },
      { text: row.Empfaenger || '', style: 'tableCell' },
      { text: row.IBAN ? (row.BIC ? (row.IBAN + '\n' + row.BIC) : row.IBAN) : '', style: 'tableCell' },
      { text: splitVerwendungszweck(row.Verwendungszweck || ''), style: 'vwzCell' },
      { text: row.EndToEndId || '', style: 'tableCell' },
      { text: formatEuro(row.Betrag ?? 0), style: 'tableCell', alignment: 'right', margin: [0,0,12,0] }
    ]);
  });

  // Summenzeile
  tableBody.push([
    { text: '', style: 'tableCell' },
    { text: '', style: 'tableCell' },
    { text: '', style: 'tableCell' },
    { text: '', style: 'tableCell' },
    { text: 'Summe:', style: 'tableHeader', alignment: 'right' },
    { text: formatEuro(totalAmount), style: 'tableHeader', alignment: 'right', margin: [0,0,12,0] }
  ]);

  const docDefinition: any = {
    pageOrientation: 'landscape',
    pageSize: 'A4',
    pageMargins: [18, 14, 18, 25],
    footer: function(currentPage: number, pageCount: number) {
      return {
        columns: [
          { text: `Erstellt: ${formatGermanDateTime(creDtTm)}`, alignment: 'left', fontSize: 7, margin: [4, 0, 0, 0] },
          { text: `Datei: Erfassungsprotokoll_${msgId}.pdf`, alignment: 'center', fontSize: 7 },
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

  pdfMake.createPdf(docDefinition).download(`Erfassungsprotokoll_${msgId}.pdf`);
}