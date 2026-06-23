$text = Get-Content "app.js" -Raw
$braces = 0
$parens = 0

for ($i = 0; $i -lt $text.Length; $i++) {
    $c = $text[$i]
    if ($c -eq "{") { $braces++ }
    if ($c -eq "}") { $braces-- }
    if ($c -eq "(") { $parens++ }
    if ($c -eq ")") { $parens-- }
}

Write-Host "Final Braces: $braces"
Write-Host "Final Parens: $parens"
