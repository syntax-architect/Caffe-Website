Add-Type -AssemblyName System.Drawing

$bmp = New-Object System.Drawing.Bitmap 1200, 630
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Deep luxury dark background (#110B08)
$bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(17, 11, 8))
$g.FillRectangle($bgBrush, 0, 0, 1200, 630)

# Golden ambient glow
$glowBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new(1200, 630),
    [System.Drawing.Color]::FromArgb(45, 212, 175, 55),
    [System.Drawing.Color]::FromArgb(0, 17, 11, 8)
)
$g.FillRectangle($glowBrush, 0, 0, 1200, 630)

# Golden border
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(160, 212, 175, 55), [float]3.0)
$g.DrawRectangle($pen, 24, 24, 1152, 582)

# Inner border
$innerPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(50, 212, 175, 55), [float]1.0)
$g.DrawRectangle($innerPen, 36, 36, 1128, 558)

# Fonts
$familyArial = New-Object System.Drawing.FontFamily "Arial"
$familyGeorgia = New-Object System.Drawing.FontFamily "Georgia"

$tagFont = [System.Drawing.Font]::new($familyArial, [float]14.0, [System.Drawing.FontStyle]::Bold)
$titleFont = [System.Drawing.Font]::new($familyGeorgia, [float]48.0, [System.Drawing.FontStyle]::Bold)
$subFont = [System.Drawing.Font]::new($familyGeorgia, [float]22.0, [System.Drawing.FontStyle]::Italic)
$descFont = [System.Drawing.Font]::new($familyArial, [float]16.0, [System.Drawing.FontStyle]::Regular)
$metaFont = [System.Drawing.Font]::new($familyArial, [float]15.0, [System.Drawing.FontStyle]::Bold)

# Brushes
$goldBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(212, 175, 55))
$whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 240, 235))
$mutedBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 170, 160))

# Text rendering
$g.DrawString("CANTONMENT BARRACKPORE  •  ARTISANAL GASTRONOMY", $tagFont, $goldBrush, [float]75.0, [float]95.0)
$g.DrawString("The Café Barrackpore", $titleFont, $whiteBrush, [float]72.0, [float]145.0)
$g.DrawString("Artisanal Coffee, Wood-Fired Pizzas & Crafted Mocktails", $subFont, $goldBrush, [float]75.0, [float]235.0)

$g.DrawString("Experience Barrackpore's premier nocturnal dining retreat. Handcrafted regional", $descFont, $mutedBrush, [float]75.0, [float]320.0)
$g.DrawString("comforts, intimate velvet booth seating, and acoustic weekend lounge atmosphere.", $descFont, $mutedBrush, [float]75.0, [float]355.0)

# Rating Badge Pill
$badgeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 26, 17, 12))
$badgePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 212, 175, 55), [float]2.0)
$g.FillRectangle($badgeBrush, 75, 450, 520, 60)
$g.DrawRectangle($badgePen, 75, 450, 520, 60)
$g.DrawString("★ 4.8 GOOGLE RATING  •  OPEN DAILY 11:00 AM - 11:30 PM", $metaFont, $goldBrush, [float]95.0, [float]470.0)

$g.Dispose()

$targetDir = "c:\Users\Pc\OneDrive\Desktop\Caffe BKP\the-cafe-barrackpore\public\images"
if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force }
$outPath = Join-Path $targetDir "og-share.jpg"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmp.Dispose()
Write-Output "Successfully generated: $outPath"
