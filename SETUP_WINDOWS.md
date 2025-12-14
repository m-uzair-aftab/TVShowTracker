# Windows Setup - PowerShell Execution Policy Fix

You're encountering a PowerShell execution policy error. Here are three solutions:

## Solution 1: Use Command Prompt (Easiest - No Admin Required)

1. Open **Command Prompt** (cmd.exe) instead of PowerShell
   - Press `Win + R`, type `cmd`, press Enter
   - Or search for "Command Prompt" in the Start menu

2. Navigate to your project directory:
   ```cmd
   cd <project-root>
   ```

3. Run npm commands normally:
   ```cmd
   npm install
   ```

## Solution 2: Change PowerShell Execution Policy (Requires Admin)

1. Open PowerShell as Administrator:
   - Right-click on PowerShell in Start menu
   - Select "Run as Administrator"

2. Run this command to allow local scripts:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. Close and reopen your regular PowerShell window

4. Navigate to your project and run:
   ```powershell
   npm install
   ```

## Solution 3: Bypass Policy for Current Session (Temporary)

If you want to stay in PowerShell without changing the policy permanently:

1. In your current PowerShell window, run:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
   ```

2. Then run your npm command:
   ```powershell
   npm install
   ```

**Note:** This only works for the current PowerShell session. You'll need to run it again each time you open a new PowerShell window.

## Recommended Approach

For development, I recommend **Solution 1** (using Command Prompt) as it's the simplest and doesn't require any policy changes. Command Prompt works perfectly fine for npm commands.

After running `npm install`, you can continue with the setup steps from `LOCAL_SETUP.md`.
