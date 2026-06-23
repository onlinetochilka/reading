$text = Get-Content "app.js" -Raw
$b = 0
$p = 0
for ($i=0; $i -lt $text.Length; $i++) {
    $c = $text[$i]
    if ($c -eq "{") { $b++ }
    if ($c -eq "}") { $b-- }
    if ($c -eq "(") { $p++ }
    if ($c -eq ")") { 
        $p--
        if ($p -lt 0) { 
            Write-Host "Negative Parens at index $i, char around: $($text.Substring($i-20, 40))"
            break 
        }
    }
}
Write-Host "Done"
