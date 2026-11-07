const {spawn} = require('node:child_process');

// No shell interpolation; on Windows terminate Git/Chrome descendants as well.
function run(command, args, {cwd, timeoutMs=20000, input, env=process.env}={}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd, env, windowsHide:true,
      ...(process.platform !== 'win32' ? {detached:true} : {}), stdio:['pipe', 'pipe', 'pipe']});
    let stdout='', stderr='', timedOut=false, killer, cleanupTimer;
    const timer = setTimeout(() => {
      timedOut=true;
      cleanupTimer=setTimeout(()=>{
        const error=new Error(`${command} timed out; cleanup of PID ${child.pid} was blocked. Stop the task and check process permissions`);
        Object.assign(error,{timedOut:true,killFailed:true,stdout,stderr});
        child.unref(); child.stdout.destroy(); child.stderr.destroy();
        reject(error);
      },5000);
      cleanupTimer.unref();
      if (process.platform === 'win32') {
        killer=spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {windowsHide:true, stdio:'ignore'});
        killer.on('error', () => child.kill());
        killer.on('exit', code => {if(code!==0) child.kill();});
      } else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
    }, timeoutMs);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', data => {stdout+=data;});
    child.stderr.on('data', data => {stderr+=data;});
    child.stdin.on('error', () => {}); // A failed spawn/early exit may close stdin first.
    child.stdin.end(input);
    child.on('error', error => {clearTimeout(timer); clearTimeout(cleanupTimer); reject(error);});
    child.on('close', code => {
      clearTimeout(timer);
      clearTimeout(cleanupTimer);
      const result={code, stdout, stderr, timedOut};
      if (code === 0 && !timedOut) return resolve(result);
      const error=new Error(timedOut ? `${command} timed out after ${timeoutMs}ms` :
        `${command} exited ${code}: ${stderr.trim() || stdout.trim()}`);
      Object.assign(error, result); reject(error);
    });
  });
}
module.exports={run};
