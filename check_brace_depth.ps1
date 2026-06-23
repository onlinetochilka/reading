$text = Get-Content "app.js" -Raw
$b = 0
for ($i=0; $i -lt $text.Length; $i++) {
    $c = $text[$i]
    if ($c -eq "{") { $b++ }
    if ($c -eq "}") { $b-- }
    
    if ($c -eq "`n") {
        $substr = $text.Substring($i+1, [math]::Min(20, $text.Length - $i - 1))
        if ($substr -match "^\s*function ") {
            $funcName = ($substr -split "\(")[0].Trim()
            Write-Host "$funcName | brace depth = $b"
        }
    }
}
Write-Host "Done"
