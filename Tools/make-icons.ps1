# Generates assets/pause.png and assets/play.png (1024x1024) for the Discord app's Rich Presence art assets.
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'assets'
New-Item -ItemType Directory -Force $out | Out-Null
$S = 1024

function New-Icon([string]$name, [scriptblock]$glyph) {
    $bmp = New-Object System.Drawing.Bitmap $S, $S
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 88, 101, 242))), 0, 0, $S, $S)
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    & $glyph $g $white
    $bmp.Save((Join-Path $out "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}

New-Icon 'pause' {
    param($g, $b)
    $g.FillRectangle($b, 310, 270, 150, 484)
    $g.FillRectangle($b, 564, 270, 150, 484)
}
New-Icon 'play' {
    param($g, $b)
    $pts = [System.Drawing.Point[]]@((New-Object System.Drawing.Point 380, 260), (New-Object System.Drawing.Point 780, 512), (New-Object System.Drawing.Point 380, 764))
    $g.FillPolygon($b, $pts)
}
