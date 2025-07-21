#!/bin/bash

# VBA Syntax Validation Script
# This script performs basic syntax validation for the VBA module

echo "=== VBA Module Validation ==="
echo "Checking modFormelZuordnung.bas for Excel 2019 compliance..."
echo

VBA_FILE="/home/runner/work/MeinElectronApp/MeinElectronApp/vba/modFormelZuordnung.bas"

if [ ! -f "$VBA_FILE" ]; then
    echo "❌ ERROR: VBA file not found at $VBA_FILE"
    exit 1
fi

echo "✅ VBA file found"

# Check for explicit parameter declarations
echo "Checking for explicit ByVal/ByRef declarations..."
BYVAL_COUNT=$(grep -c "ByVal" "$VBA_FILE")
BYREF_COUNT=$(grep -c "ByRef" "$VBA_FILE")
echo "   - ByVal declarations found: $BYVAL_COUNT"
echo "   - ByRef declarations found: $BYREF_COUNT"

if [ $BYVAL_COUNT -gt 0 ]; then
    echo "✅ Explicit ByVal declarations present"
else
    echo "⚠️  WARNING: No ByVal declarations found"
fi

# Check for proper Option Explicit
if grep -q "Option Explicit" "$VBA_FILE"; then
    echo "✅ Option Explicit declaration found"
else
    echo "❌ ERROR: Option Explicit missing"
fi

# Check for error handling
if grep -q "On Error GoTo" "$VBA_FILE"; then
    echo "✅ Error handling implemented"
else
    echo "⚠️  WARNING: No error handling found"
fi

# Check for object cleanup
if grep -q "Set .* = Nothing" "$VBA_FILE"; then
    echo "✅ Object cleanup implemented"
else
    echo "⚠️  WARNING: Object cleanup not found"
fi

# Check for late binding (CreateObject)
CREATEOBJECT_COUNT=$(grep -c "CreateObject" "$VBA_FILE")
if [ $CREATEOBJECT_COUNT -gt 0 ]; then
    echo "✅ Late binding used ($CREATEOBJECT_COUNT instances)"
else
    echo "⚠️  WARNING: No late binding found"
fi

# Check for With statements (good practice)
WITH_COUNT=$(grep -c "With " "$VBA_FILE")
if [ $WITH_COUNT -gt 0 ]; then
    echo "✅ With statements used ($WITH_COUNT instances)"
else
    echo "⚠️  INFO: No With statements found"
fi

# Basic syntax checks
echo
echo "Performing basic syntax checks..."

# Check for mismatched parentheses
OPEN_PARENS=$(grep -o "(" "$VBA_FILE" | wc -l)
CLOSE_PARENS=$(grep -o ")" "$VBA_FILE" | wc -l)
if [ $OPEN_PARENS -eq $CLOSE_PARENS ]; then
    echo "✅ Parentheses appear balanced ($OPEN_PARENS pairs)"
else
    echo "⚠️  WARNING: Parentheses may be unbalanced (Open: $OPEN_PARENS, Close: $CLOSE_PARENS)"
fi

# Check for function/sub endings
FUNCTION_COUNT=$(grep -c "^Function\|^Public Function\|^Private Function" "$VBA_FILE")
SUB_COUNT=$(grep -c "^Sub\|^Public Sub\|^Private Sub" "$VBA_FILE")
END_FUNCTION_COUNT=$(grep -c "End Function" "$VBA_FILE")
END_SUB_COUNT=$(grep -c "End Sub" "$VBA_FILE")

echo "Functions: $FUNCTION_COUNT, End Function: $END_FUNCTION_COUNT"
echo "Subs: $SUB_COUNT, End Sub: $END_SUB_COUNT"

if [ $FUNCTION_COUNT -eq $END_FUNCTION_COUNT ] && [ $SUB_COUNT -eq $END_SUB_COUNT ]; then
    echo "✅ All Functions and Subs properly closed"
else
    echo "❌ ERROR: Mismatched Function/Sub declarations"
fi

echo
echo "=== Validation Complete ==="

# Summary
ERRORS=0
WARNINGS=0

if [ $FUNCTION_COUNT -ne $END_FUNCTION_COUNT ] || [ $SUB_COUNT -ne $END_SUB_COUNT ]; then
    ERRORS=$((ERRORS + 1))
fi

if ! grep -q "Option Explicit" "$VBA_FILE"; then
    ERRORS=$((ERRORS + 1))
fi

if [ $BYVAL_COUNT -eq 0 ]; then
    WARNINGS=$((WARNINGS + 1))
fi

if ! grep -q "On Error GoTo" "$VBA_FILE"; then
    WARNINGS=$((WARNINGS + 1))
fi

echo "Errors: $ERRORS, Warnings: $WARNINGS"

if [ $ERRORS -eq 0 ]; then
    echo "🎉 VBA module appears to be syntactically correct for Excel 2019!"
    exit 0
else
    echo "❌ VBA module has errors that need to be fixed"
    exit 1
fi