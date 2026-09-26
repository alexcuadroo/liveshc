param([switch]$AllowMissingSounds)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Minecraft reads ZIP entries with Java's ZipFile, which does not translate
# backslashes. Compress-Archive writes Windows-style separators, so entries
# become unreachable and resource namespaces are never detected. Build the ZIP
# manually to guarantee forward slashes.
function Write-ZipForwardSlash {
    param(
        [Parameter(Mandatory)][string]$SourceDirectory,
        [Parameter(Mandatory)][string]$DestinationPath
    )
    $archive = [System.IO.Compression.ZipFile]::Open($DestinationPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($directory in Get-ChildItem -LiteralPath $SourceDirectory -Recurse -Directory) {
            $entryName = $directory.FullName.Substring($SourceDirectory.Length + 1).Replace('\', '/') + '/'
            $archive.CreateEntry($entryName) | Out-Null
        }
        foreach ($file in Get-ChildItem -LiteralPath $SourceDirectory -Recurse -File) {
            $entryName = $file.FullName.Substring($SourceDirectory.Length + 1).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally {
        $archive.Dispose()
    }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $projectRoot 'resource-pack/source'
$outputRoot = Join-Path $projectRoot 'build/resource-packs'
$soundRoot = Join-Path $sourceRoot 'assets/hardcoresounds/sounds'
$soundsJson = Join-Path $sourceRoot 'assets/hardcoresounds/sounds.json'
$soundsDefinition = Get-Content -Raw -LiteralPath $soundsJson | ConvertFrom-Json
$requiredSounds = @(
    $soundsDefinition.PSObject.Properties.Value |
        ForEach-Object { $_.sounds } |
        ForEach-Object { (($_ -split ':')[-1]) + '.ogg' } |
        Sort-Object -Unique
)
$missing = @($requiredSounds | Where-Object { -not (Test-Path -LiteralPath (Join-Path $soundRoot $_)) })

if ($missing.Count -gt 0 -and -not $AllowMissingSounds) {
    throw "Missing required sounds: $($missing -join ', '). Add them under resource-pack/source/assets/hardcoresounds/sounds or pass -AllowMissingSounds."
}

foreach ($soundName in $requiredSounds) {
    $soundPath = Join-Path $soundRoot $soundName
    if (Test-Path -LiteralPath $soundPath) {
        $bytes = [IO.File]::ReadAllBytes($soundPath)
        if ($bytes.Length -lt 4 -or [Text.Encoding]::ASCII.GetString($bytes, 0, 4) -ne 'OggS') {
            throw "$soundName is not an Ogg container. Convert it to Ogg Vorbis before building."
        }
    }
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

foreach ($profile in @('26.1', '26.2', '26.3')) {
    $metadataPath = Join-Path $projectRoot "resource-pack/pack-$profile.mcmeta"
    $metadata = Get-Content -Raw -LiteralPath $metadataPath | ConvertFrom-Json
    if ($null -eq $metadata.pack.min_format -or $null -eq $metadata.pack.max_format) {
        throw "pack-$profile.mcmeta must declare min_format and max_format."
    }
    $stage = Join-Path $outputRoot "stage-$profile"
    $zip = Join-Path $outputRoot "hardcoresounds-$profile.zip"
    if (Test-Path -LiteralPath $stage) { Remove-Item -Recurse -Force -LiteralPath $stage }
    if (Test-Path -LiteralPath $zip) { Remove-Item -Force -LiteralPath $zip }
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    Copy-Item -Recurse -LiteralPath (Join-Path $sourceRoot 'assets') -Destination $stage
    Get-ChildItem -LiteralPath $stage -Recurse -Filter '.gitkeep' | Remove-Item -Force
    Copy-Item -LiteralPath $metadataPath -Destination (Join-Path $stage 'pack.mcmeta')
    Write-ZipForwardSlash -SourceDirectory $stage -DestinationPath $zip
    Remove-Item -Recurse -Force -LiteralPath $stage
    $hash = (Get-FileHash -Algorithm SHA1 -LiteralPath $zip).Hash.ToLowerInvariant()
    Write-Output "$zip  SHA-1: $hash"
}
