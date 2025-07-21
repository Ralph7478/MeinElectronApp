Attribute VB_Name = "modFormelZuordnung"
Option Explicit

' ===============================================================================
' Module: modFormelZuordnung
' Purpose: Excel 2019 compliant VBA module for formula assignment and IBAN processing
' Version: 2.0 - Excel 2019 Compatible
' Date: 2024
' ===============================================================================

' --- IBAN-Extraktion ---
' Extracts German IBAN from text using regex pattern
' Parameters explicitly declared as ByVal for Excel 2019 compliance
Function ExtractDEIBAN(ByVal text As String) As String
    Dim regex As Object
    Set regex = CreateObject("VBScript.RegExp")
    
    With regex
        .Pattern = "DE\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}"
        .Global = False
        .IgnoreCase = True
    End With
    
    If regex.Test(text) Then
        ExtractDEIBAN = Replace(regex.Execute(text)(0), " ", "")
    Else
        ExtractDEIBAN = ""
    End If
    
    Set regex = Nothing
End Function

' --- Zellbezüge in Formeln intelligent anpassen ---
' Adjusts cell references in formulas based on row difference
' All parameters explicitly declared for Excel 2019 compliance
Function AdjustFormulaReferences(ByVal srcFormula As String, ByVal srcRow As Long, ByVal tgtRow As Long) As String
    Dim regex As Object, matches As Object, m As Object
    Dim newFormula As String
    Dim rowDiff As Long
    Dim cellPattern As String
    Dim i As Long
    
    rowDiff = tgtRow - srcRow
    newFormula = srcFormula

    ' Muster für Zellbezüge (wie $A$1, A1, $A1, A$1)
    cellPattern = "(\$?[A-Za-z]{1,3}\$?\d{1,7})"
    Set regex = CreateObject("VBScript.RegExp")
    
    With regex
        .Global = True
        .IgnoreCase = False
        .Pattern = cellPattern
    End With
    
    Set matches = regex.Execute(srcFormula)
    
    ' Rückwärts ersetzen, damit Indizes stimmen
    For i = matches.Count - 1 To 0 Step -1
        Set m = matches(i)
        Dim oldRef As String
        Dim newRef As String
        oldRef = m.Value
        newRef = AdjustCellRef(oldRef, rowDiff)
        If newRef <> oldRef Then
            newFormula = Left(newFormula, m.FirstIndex) & newRef & Mid(newFormula, m.FirstIndex + Len(oldRef) + 1)
        End If
    Next i

    AdjustFormulaReferences = newFormula
    
    Set regex = Nothing
    Set matches = Nothing
End Function

' --- Einzelner Zellbezug: Passe Zeile entsprechend an (nur wenn Bezug nicht absolut ist) ---
' Adjusts individual cell reference based on row difference
' Parameters explicitly declared for Excel 2019 compliance
Function AdjustCellRef(ByVal cellRef As String, ByVal rowDiff As Long) As String
    Dim regex As Object
    Dim colPart As String, rowPart As String
    Dim colAbs As Boolean, rowAbs As Boolean
    Dim rowNum As Long
    Dim match As Object

    Set regex = CreateObject("VBScript.RegExp")
    With regex
        .Pattern = "^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})$"
        .Global = False
    End With

    If regex.Test(cellRef) Then
        Set match = regex.Execute(cellRef)(0)
        colAbs = (match.SubMatches(0) = "$")
        colPart = match.SubMatches(1)
        rowAbs = (match.SubMatches(2) = "$")
        rowPart = match.SubMatches(3)
        rowNum = CLng(rowPart)
        
        If Not rowAbs Then
            rowNum = rowNum + rowDiff
            ' Ensure row number is positive
            If rowNum < 1 Then rowNum = 1
        End If
        
        AdjustCellRef = IIf(colAbs, "$", "") & colPart & IIf(rowAbs, "$", "") & CStr(rowNum)
    Else
        AdjustCellRef = cellRef
    End If
    
    Set regex = Nothing
    Set match = Nothing
End Function

' --- Hilfsfunktion zum Bereinigen von Strings (entfernt Leerzeichen) ---
' Utility function to clean strings by removing spaces
' Parameter explicitly declared as ByVal for Excel 2019 compliance
Function CleanString(ByVal s As Variant) As String
    If IsNull(s) Or IsEmpty(s) Then
        CleanString = ""
    Else
        CleanString = Replace(Trim(CStr(s)), " ", "")
    End If
End Function

' --- Hauptprozedur für Formelzuordnung ---
' Main procedure for formula assignment between worksheets
' Excel 2019 compliant with improved error handling
Sub FormelZuordnung()
    ' Performance optimization for Excel 2019
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual
    
    ' Error handling for Excel 2019 compatibility
    On Error GoTo ErrorHandler

    Dim wsAktiv As Worksheet, wsIDX_KI As Worksheet, wsIDX As Worksheet, ws2025 As Worksheet
    Dim lastRowAktiv As Long, lastRowIDX_KI As Long, lastRowIDX As Long, lastRow2025 As Long
    Dim dictIDX As Object, dict2025 As Object, dictErg As Object
    Dim rAktiv As Long, rIDX_KI As Long, rIDX As Long, r2025 As Long
    Dim IBAN_Aktiv As String, IBAN_IDX_KI As String, IBAN_IDX As String, IBAN_2025 As String
    Dim tempFormula As String, tempWertActivSpN As Variant
    Dim spalteN As Integer: spalteN = 14 ' Spalte N
    Dim key As Variant, subKey As Variant
    Dim subDict As Object
    Dim cleanIBAN As String

    Debug.Print "----- FormelZuordnung startet " & Now & " -----"

    ' --- Aktives Blatt validieren (Name im Format YYYYMMDD) ---
    Set wsAktiv = ThisWorkbook.ActiveSheet
    Dim re As Object
    Set re = CreateObject("VBScript.RegExp")
    With re
        .Pattern = "^\d{8}$"
        .IgnoreCase = True
    End With
    
    If Not re.Test(wsAktiv.Name) Then
        MsgBox "Das aktive Blatt entspricht nicht dem erwarteten Format 'YYYYMMDD'! Bitte das richtige Blatt aktivieren.", vbExclamation
        GoTo CleanUp
    End If

    ' --- Worksheet-Referenzen mit Fehlerbehandlung ---
    On Error Resume Next
    Set wsIDX_KI = ThisWorkbook.Worksheets("IDX_KI")
    Set wsIDX = ThisWorkbook.Worksheets("IDX")
    Set ws2025 = ThisWorkbook.Worksheets("2025")
    On Error GoTo ErrorHandler
    
    If wsIDX_KI Is Nothing Or wsIDX Is Nothing Or ws2025 Is Nothing Then
        MsgBox "Erforderliche Arbeitsblätter (IDX_KI, IDX, 2025) nicht gefunden!", vbCritical
        GoTo CleanUp
    End If
    
    ' --- Dictionary-Objekte initialisieren ---
    Set dictIDX = CreateObject("Scripting.Dictionary")
    Set dict2025 = CreateObject("Scripting.Dictionary")
    Set dictErg = CreateObject("Scripting.Dictionary")

    ' --- Zeilen ermitteln mit Fehlerbehandlung ---
    lastRowAktiv = wsAktiv.Cells(wsAktiv.Rows.Count, "D").End(xlUp).Row
    lastRowIDX_KI = wsIDX_KI.Cells(wsIDX_KI.Rows.Count, "A").End(xlUp).Row
    lastRowIDX = wsIDX.Cells(wsIDX.Rows.Count, "G").End(xlUp).Row
    lastRow2025 = ws2025.Cells(ws2025.Rows.Count, "D").End(xlUp).Row

    ' --- IDX_KI Dictionary (Spalte A) ---
    For rIDX_KI = 2 To lastRowIDX_KI
        IBAN_IDX_KI = ExtractDEIBAN(wsIDX_KI.Cells(rIDX_KI, "A").Text)
        If IBAN_IDX_KI <> "" Then
            dictIDX(CleanString(IBAN_IDX_KI)) = rIDX_KI
        End If
    Next rIDX_KI

    ' --- IDX Dictionary (Spalte G), Vorrang vor IDX_KI bei Dopplung ---
    For rIDX = 2 To lastRowIDX
        IBAN_IDX = ExtractDEIBAN(wsIDX.Cells(rIDX, "G").Text)
        If IBAN_IDX <> "" Then
            dictIDX(CleanString(IBAN_IDX)) = rIDX
        End If
    Next rIDX

    ' --- dict2025: 1- oder 2-stufig befüllen ---
    For r2025 = 2 To lastRow2025 Step 1
        IBAN_2025 = ExtractDEIBAN(ws2025.Cells(r2025, "D").Text)
        If IBAN_2025 <> "" Then
            Dim keyIBAN As String, keyN As String
            keyIBAN = CleanString(IBAN_2025)
            keyN = CleanString(ws2025.Cells(r2025, spalteN).Value) ' Spalte N
            If keyN = "" Then
                dict2025(keyIBAN) = r2025
            Else
                If Not dict2025.Exists(keyIBAN) Or Not IsObject(dict2025(keyIBAN)) Then
                    Set dict2025(keyIBAN) = CreateObject("Scripting.Dictionary")
                End If
                Set subDict = dict2025(keyIBAN)
                subDict(keyN) = r2025
            End If
        End If
    Next r2025

    ' --- Hauptschleife über ActiveSheet Spalte D ---
    For rAktiv = 2 To lastRowAktiv
        IBAN_Aktiv = ExtractDEIBAN(wsAktiv.Cells(rAktiv, "D").Text)
        cleanIBAN = CleanString(IBAN_Aktiv)
        If cleanIBAN <> "" Then
            If dictIDX.Exists(cleanIBAN) And dict2025.Exists(cleanIBAN) Then
                ' Hole Quellzeile (bei Dictionary: nimm einfach die erste Zeile)
                Dim quellRow2025 As Long
                If IsObject(dict2025(cleanIBAN)) Then
                    For Each subKey In dict2025(cleanIBAN).Keys
                        quellRow2025 = dict2025(cleanIBAN)(subKey)
                        Exit For
                    Next
                Else
                    quellRow2025 = dict2025(cleanIBAN)
                End If

                tempWertActivSpN = ""
                If ws2025.Cells(quellRow2025, spalteN).HasFormula Then
                    tempFormula = ws2025.Cells(quellRow2025, spalteN).Formula
                    tempFormula = AdjustFormulaReferences(tempFormula, quellRow2025, rAktiv)
                    wsAktiv.Cells(rAktiv, spalteN).Formula = tempFormula
                    tempWertActivSpN = wsAktiv.Cells(rAktiv, spalteN).Value
                    wsAktiv.Cells(rAktiv, spalteN).ClearContents
                Else
                    tempWertActivSpN = ws2025.Cells(quellRow2025, spalteN).Value
                End If
                tempWertActivSpN = CleanString(tempWertActivSpN)

                Debug.Print "dictErg-Key: " & cleanIBAN & "|" & rAktiv & "|" & wsAktiv.Name & " | tempWertActivSpN: " & tempWertActivSpN
                Set dictErg(cleanIBAN & "|" & rAktiv & "|" & wsAktiv.Name) = CreateObject("Scripting.Dictionary")
                With dictErg(cleanIBAN & "|" & rAktiv & "|" & wsAktiv.Name)
                    .Add "tempWertActivSpN", tempWertActivSpN
                    .Add "Zielzeile", rAktiv
                    .Add "Sheet", wsAktiv.Name
                End With
            End If
        End If
    Next rAktiv

    ' --- Suche nach passender Zeile in 2025 mit IBAN + Wert in N ---
    For Each key In dictErg.Keys
        Set subDict = dictErg(key)
        Dim ergIban As String, ergZielzeile As Long, ergSheet As String, ergSpN As Variant
        Dim foundRow As Long
        ergIban = Split(key, "|")(0)
        ergZielzeile = subDict("Zielzeile")
        ergSheet = subDict("Sheet")
        ergSpN = subDict("tempWertActivSpN")
        foundRow = 0

        If dict2025.Exists(ergIban) Then
            If IsObject(dict2025(ergIban)) Then
                If dict2025(ergIban).Exists(ergSpN) Then
                    foundRow = dict2025(ergIban)(ergSpN)
                End If
            Else
                foundRow = dict2025(ergIban)
            End If
        End If
        
        If foundRow = 0 Then
            Debug.Print "!!! Keine Übereinstimmung für: " & ergIban & " Wert in Spalte N: " & ergSpN & " gefunden!"
        Else
            Debug.Print ">>> Treffer für " & ergIban & ": Quellzeile2025=" & foundRow
        End If
        subDict("Quellzeile2025") = foundRow
    Next key

    ' --- Werte & Formeln von F bis X übertragen ---
    Dim zielzeile As Long, quellzeile As Long
    Dim iCol As Integer
    Dim tempVal As Variant

    For Each key In dictErg.Keys
        Set subDict = dictErg(key)
        zielzeile = subDict("Zielzeile")
        If subDict.Exists("Quellzeile2025") Then
            quellzeile = subDict("Quellzeile2025")
        Else
            quellzeile = 0
        End If
        If zielzeile > 0 And quellzeile > 0 Then
            For iCol = 6 To 24 ' F bis X
                Select Case iCol
                    Case 6, 7 ' F,G: Nur Schriftfarbe übernehmen
                        wsAktiv.Cells(zielzeile, iCol).Font.Color = ws2025.Cells(quellzeile, iCol).Font.Color
                        If Len(wsAktiv.Cells(zielzeile, iCol).Value) > 0 Then
                            tempVal = wsAktiv.Cells(zielzeile, iCol).Value
                            wsAktiv.Cells(zielzeile, iCol).Value = tempVal
                        End If
                    Case 8, 10, 11, 14 ' H, J, K, N: Immer Formel oder leer
                        If ws2025.Cells(quellzeile, iCol).HasFormula Then
                            tempFormula = ws2025.Cells(quellzeile, iCol).Formula
                            tempFormula = AdjustFormulaReferences(tempFormula, quellzeile, zielzeile)
                            wsAktiv.Cells(zielzeile, iCol).Formula = tempFormula
                        Else
                            wsAktiv.Cells(zielzeile, iCol).ClearContents
                        End If
                        wsAktiv.Cells(zielzeile, iCol).Font.Color = ws2025.Cells(quellzeile, iCol).Font.Color
                        wsAktiv.Cells(zielzeile, iCol).NumberFormat = ws2025.Cells(quellzeile, iCol).NumberFormat
                    Case 9, 13, 16 To 24 ' I, M, P–X: Formel bevorzugt, sonst Wert
                        If ws2025.Cells(quellzeile, iCol).HasFormula Then
                            tempFormula = ws2025.Cells(quellzeile, iCol).Formula
                            tempFormula = AdjustFormulaReferences(tempFormula, quellzeile, zielzeile)
                            wsAktiv.Cells(zielzeile, iCol).Formula = tempFormula
                        Else
                            wsAktiv.Cells(zielzeile, iCol).Value = ws2025.Cells(quellzeile, iCol).Value
                        End If
                        wsAktiv.Cells(zielzeile, iCol).Font.Color = ws2025.Cells(quellzeile, iCol).Font.Color
                        wsAktiv.Cells(zielzeile, iCol).NumberFormat = ws2025.Cells(quellzeile, iCol).NumberFormat
                    Case Else ' Andere: Wert und Format
                        wsAktiv.Cells(zielzeile, iCol).Value = ws2025.Cells(quellzeile, iCol).Value
                        wsAktiv.Cells(zielzeile, iCol).Font.Color = ws2025.Cells(quellzeile, iCol).Font.Color
                        wsAktiv.Cells(zielzeile, iCol).NumberFormat = ws2025.Cells(quellzeile, iCol).NumberFormat
                End Select
            Next iCol
        End If
    Next key

    ' --- Debug-Ausgaben für Entwicklung ---
    Call PrintDictErg(dictErg)
    Call PrintDict2025(dict2025)

    Debug.Print "----- FormelZuordnung beendet " & Now & " -----"
    MsgBox "Fertig! Spalten F bis X wurden übertragen.", vbInformation

CleanUp:
    ' Cleanup für Excel 2019 Kompatibilität
    Set wsAktiv = Nothing
    Set wsIDX_KI = Nothing
    Set wsIDX = Nothing
    Set ws2025 = Nothing
    Set dictIDX = Nothing
    Set dict2025 = Nothing
    Set dictErg = Nothing
    Set re = Nothing
    
    Application.Calculation = xlCalculationAutomatic
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    Exit Sub

ErrorHandler:
    MsgBox "Fehler in FormelZuordnung: " & Err.Description & " (Nr: " & Err.Number & ")", vbCritical
    Resume CleanUp
End Sub

' --- Helper-Prozeduren für Debug-Ausgaben ---
' Separate procedures for better code organization in Excel 2019

Private Sub PrintDictErg(ByRef dictErg As Object)
    Dim ergKey As Variant, ergSubDict As Object, ergSubKey As Variant
    Debug.Print "----- dictErg vollständiger Dump -----"
    For Each ergKey In dictErg.Keys
        Set ergSubDict = dictErg(ergKey)
        Debug.Print "Key: " & ergKey
        For Each ergSubKey In ergSubDict.Keys
            Debug.Print "    " & ergSubKey & ": " & ergSubDict(ergSubKey)
        Next ergSubKey
    Next ergKey
    Debug.Print "--------------------------------------"
End Sub

Private Sub PrintDict2025(ByRef dict2025 As Object)
    Dim d25Key As Variant, d25SubDict As Object, d25SubKey As Variant
    Debug.Print "----- dict2025 vollständiger Dump -----"
    For Each d25Key In dict2025.Keys
        If IsObject(dict2025(d25Key)) Then
            Set d25SubDict = dict2025(d25Key)
            Debug.Print "dict2025(" & d25Key & ") ist Dictionary:"
            For Each d25SubKey In d25SubDict.Keys
                Debug.Print "    " & d25SubKey & " ? " & d25SubDict(d25SubKey)
            Next d25SubKey
        Else
            Debug.Print "dict2025(" & d25Key & ") ? " & dict2025(d25Key)
        End If
    Next d25Key
    Debug.Print "--------------------------------------"
End Sub