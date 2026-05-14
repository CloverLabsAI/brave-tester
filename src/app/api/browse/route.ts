import { NextResponse } from "next/server";
import { exec } from "node:child_process";

// Detect default WSL distro name
function getWslDistro(): Promise<string> {
  return new Promise((resolve) => {
    exec("wsl -l -q", { timeout: 5000 }, (error, stdout) => {
      if (error) { resolve("Ubuntu"); return; }
      // wsl -l outputs UTF-16LE with null bytes
      const clean = stdout.replace(/\0/g, "").trim();
      const first = clean.split("\n")[0]?.trim();
      resolve(first || "Ubuntu");
    });
  });
}

export async function POST(request: Request) {
  const platform = process.platform;

  let buildPlatform = "auto";
  try {
    const body = await request.json();
    buildPlatform = body.buildPlatform || "auto";
  } catch {
    // No body or invalid JSON - use defaults
  }

  // On Windows with Linux build selected, open file dialog in WSL filesystem
  const isLinuxOnWindows = platform === "win32" && buildPlatform === "linux";

  let command: string;
  if (platform === "darwin") {
    // Allow selecting .app bundles or raw executables
    command = `osascript -e 'set f to POSIX path of (choose file with prompt "Select Brave.app or binary" of type {"com.apple.application-bundle", "public.unix-executable", "public.data"})' -e 'return f'`;
  } else if (platform === "win32") {
    let initialDir = "";
    if (isLinuxOnWindows) {
      const distro = await getWslDistro();
      initialDir = `$f.InitialDirectory = '\\\\wsl$\\${distro}\\home'; `;
    }
    command = `powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class DPI { [DllImport(\\\"user32.dll\\\")] public static extern bool SetProcessDPIAware(); }'; [void][DPI]::SetProcessDPIAware(); Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Title = 'Select Brave binary'; $f.Filter = 'All files (*.*)|*.*|Executable files (*.exe)|*.exe'; ${initialDir}if ($f.ShowDialog() -eq 'OK') { $f.FileName } else { '' }"`;
  } else {
    // Linux - try zenity, kdialog, or return error
    command = `zenity --file-selection --title="Select Brave binary" 2>/dev/null || kdialog --getopenfilename ~ "All files (*)" 2>/dev/null`;
  }

  try {
    const path = await new Promise<string>((resolve, reject) => {
      exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          // User cancelled or dialog failed
          if (error.killed || error.code === 1) {
            resolve("");
            return;
          }
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout.trim());
      });
    });

    if (!path) {
      return NextResponse.json({ path: null, cancelled: true });
    }

    // On macOS, auto-resolve .app bundle to the binary inside
    let resolvedPath = path;
    if (resolvedPath.endsWith(".app") || resolvedPath.endsWith(".app/")) {
      resolvedPath = resolvedPath.replace(/\/$/, "") + "/Contents/MacOS/Brave Browser Development";
    }

    return NextResponse.json({ path: resolvedPath, cancelled: false });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to open file dialog", path: null },
      { status: 500 }
    );
  }
}
