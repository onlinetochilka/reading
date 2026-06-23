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
        if ($p -lt 1 -and $i -gt 20 -and $i -lt ($text.Length - 50)) { 
            Write-Host "Parens dropped to 0 at index $i, char around: $($text.Substring($i-40, 80))"
            break 
        }
    }
}
Write-Host "Done"
