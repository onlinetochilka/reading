$text = Get-Content "app.js" -Raw
$p = 0
for ($i=0; $i -lt $text.Length; $i++) {
    $c = $text[$i]
    if ($c -eq '(') { $p++ }
    if ($c -eq ')') { $p-- }
    
    # Just after a newline, if we see "function", print depth
    if ($c -eq "`n") {
        $substr = $text.Substring($i+1, [math]::Min(20, $text.Length - $i - 1))
        if ($substr -match "^\s*function ") {
            $funcName = ($substr -split "\(")[0].Trim()
            Write-Host "$funcName | parens depth = $p"
        }
    }
}
Write-Host "Done"
