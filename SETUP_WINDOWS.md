# Windows Setup Notes

If PowerShell blocks npm scripts because of execution policy settings, use one of these approaches.

## Use Command Prompt

Open Command Prompt, navigate to the project root, and run npm commands normally:

```cmd
npm install
npm run dev
```

## Temporarily Bypass PowerShell Policy

In the current PowerShell session:

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

Then run:

```powershell
npm install
npm run dev
```

## Change Current User Policy

If you are comfortable changing your user-level PowerShell policy:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Restart PowerShell before running npm commands again.
