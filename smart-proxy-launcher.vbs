Option Explicit

' Smart Proxy v35 launcher. Embedded release binaries use their bundled
' resources; development binaries automatically fall back to .\resources.

Dim fso, shell, root, exePath, lockPath, signalPath, ackPath, running, silentMode, windowShown
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root
exePath = fso.BuildPath(root, "smart-proxy-client-win_x64.exe")
lockPath = fso.BuildPath(root, "smart-proxy-data\runtime\app-instance.lock")
signalPath = fso.BuildPath(root, "smart-proxy-data\runtime\show-window.signal")
ackPath = fso.BuildPath(root, "smart-proxy-data\runtime\show-window.ack")
running = IsTargetRunning(exePath, lockPath)
silentMode = HasArgument("--silent")

If HasArgument("--check") Then
  WScript.Echo "running=" & LCase(CStr(running))
  WScript.Quit 0
End If

If running Then
  windowShown = SignalPrimary(signalPath, ackPath)
  If windowShown Then WScript.Quit 0
  WScript.Quit 6
End If

If Not fso.FileExists(exePath) Then
  Call shell.Popup("Smart Proxy executable was not found.", 8, "Smart Proxy", 16)
  WScript.Quit 5
End If

' Dedicated WebView2 profile: never share the browser process with other
' smart-proxy instances (shared EBWebView caused white-window compositor bugs).
Dim envProc
Set envProc = shell.Environment("PROCESS")
envProc("WEBVIEW2_USER_DATA_FOLDER") = fso.BuildPath(root, "smart-proxy-data\runtime\webview-profile")

Dim launchCommand, windowStyle
launchCommand = """" & exePath & """ --start-proxy"
windowStyle = 1
If silentMode Then
  ' NOTE 1: never pass --window-hidden: it creates the WebView2 controller
  ' invisible and Neutralino's show() never flips it back (permanent white
  ' window; document.visibilityState stays "hidden").
  ' NOTE 2: keep windowStyle=1 even for silent: style 0 sets STARTUPINFO
  ' wShowWindow=SW_HIDE and Windows overrides the app's FIRST ShowWindow call,
  ' which also leaves the webview compositor permanently invisible.
  ' App JS stashes the window (show -> minimize -> hide) at end of boot.
  launchCommand = launchCommand & " --silent"
End If
shell.Run launchCommand, windowStyle, False



Function HasArgument(targetArgument)
  Dim argument
  HasArgument = False
  For Each argument In WScript.Arguments
    If LCase(CStr(argument)) = LCase(CStr(targetArgument)) Then
      HasArgument = True
      Exit Function
    End If
  Next
End Function

Function SignalPrimary(commandPath, acknowledgmentPath)
  Dim token, stream, attempt, ackText
  SignalPrimary = False
  token = fso.GetTempName

  On Error Resume Next
  Set stream = fso.CreateTextFile(commandPath, True, False)
  stream.Write "{""token"":""" & token & """,""action"":""show"",""at"":0,""reason"":""launcher""}"
  stream.Close
  If Err.Number <> 0 Then
    Err.Clear
    On Error GoTo 0
    Exit Function
  End If
  On Error GoTo 0

  For attempt = 1 To 30
    WScript.Sleep 100
    If fso.FileExists(acknowledgmentPath) Then
      ackText = ""
      On Error Resume Next
      Set stream = fso.OpenTextFile(acknowledgmentPath, 1, False)
      ackText = stream.ReadAll
      stream.Close
      Err.Clear
      On Error GoTo 0
      If InStr(1, ackText, """token"":""" & token & """", vbTextCompare) > 0 Then
        SignalPrimary = InStr(1, ackText, """ok"":true", vbTextCompare) > 0
        Exit Function
      End If
    End If
  Next
End Function

Function IsTargetRunning(targetPath, instanceLockPath)
  Dim service, processes, process, normalizedTarget, queryFailed
  normalizedTarget = LCase(fso.GetAbsolutePathName(targetPath))
  IsTargetRunning = False
  queryFailed = False
  On Error Resume Next
  Set service = GetObject("winmgmts:\\.\root\cimv2")
  Set processes = service.ExecQuery("SELECT ExecutablePath FROM Win32_Process WHERE Name='smart-proxy-client-win_x64.exe'")
  If Err.Number <> 0 Then
    queryFailed = True
    Err.Clear
  Else
    For Each process In processes
      If Not IsNull(process.ExecutablePath) Then
        If LCase(fso.GetAbsolutePathName(CStr(process.ExecutablePath))) = normalizedTarget Then
          IsTargetRunning = True
          Exit For
        End If
      End If
    Next
    If Err.Number <> 0 Then
      queryFailed = True
      Err.Clear
    End If
  End If
  On Error GoTo 0
  If queryFailed And fso.FileExists(instanceLockPath) Then IsTargetRunning = True
End Function
