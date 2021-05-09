// here is monitor
const version = "1.0-pre1";
const release_date = "2021-05-09";

// nodejs module
const fs = require('fs');
const path = require('path');
const http = require('http');
const open = require('open');
const wait = require('waait');
const socketIO = require('socket.io');
const socketCL = require('socket.io-client');
const child_process = require('child_process');
const check = require('check-internet-connected');
const {app, BrowserWindow, ipcMain, Menu, shell, Tray, Notification, nativeImage} = require('electron');

// custom module
const storage = require('./lib/localStorage');
const request = require('./lib/request');
const logger = require('./lib/logger');
const regedit = require('./lib/reg');

// variables
const internalHttpServer = http.createServer();
const externalHttpServer = http.createServer();
let regList, str, config, L, lang; // 전역변수
let UA_win, NCA_win; // 로드 속도 개선
let tray = null, core = null; // 전역변수

// 공통 호출
const notify = async (title = '', body = '', icon = '', isURL = false) => {
    await L.info(`[notify("${title}", "${body}, "${icon}", ${isURL}) Called]`);

    let icon_data = icon;
    if (isURL) {
        try {
            let buffer = await request.getBuffer(icon_data);
            icon_data = nativeImage.createFromBuffer(buffer);
        } catch {
            icon_data = '';
        }
    }
    new Notification({
        title, body, icon: icon_data
    }).show();
}

const exit = async (exitCode=0) => {
    // 비정상 종료는 통신단에서 알림 처리하고 넘어옴!
    if (exitCode === 0) await notify(lang.exitAlert);
    await L.info(`Monitor exit with Code ${exitCode}.\n`);
    //if (UA_win !== null) UA_win.destroy();
    //if (NCA_win !== null) NCA_win.destroy();
    if (core !== null) core.kill();
    if (tray !== null) tray.destroy();
    app.quit();
    process.exit(exitCode);
}

const isEmpty = obj => {
    for (let key in obj) if (obj.hasOwnProperty(key)) return false;
    return true;
}

const checkConnection = async () => {
    try {
        await check({
            timeout: 3000,
            retries: 3,
            domain: '1.1.1.1'
        });
    } catch (e) {
        return {result: "Fail", lev: 0};
    }

    try {
        await check({
            timeout: 3000,
            retries: 3,
            domain: 'https://adobe.discordrpc.org/'
        });
    } catch (e) {
        return {result: "Fail", lev: 1};
    }

    try {
        await check({
            timeout: 3000,
            retries: 3,
            domain: 'https://cdn.discordrpc.org/'
        });
        return {result: "Success", lev: -1};
    } catch (e) {
        return {result: "Fail", lev: 2};
    }
}

/* --------------------------------------------- */

const start = async () => {
    await L.info('[Monitor START]');

    /* Monitor <-> internal process (Core) */
    let connectCounter = 0;
    let internalIO = new socketIO.Server(internalHttpServer);

    internalIO.on('connection', async socket => {
        connectCounter++;
        await L.info(`internal socket connected = id : ${socket.id}`);

        socket.on('message', async req => {
            let message = '';
            if (req.message) message = `[${socket.id}] : ${req.message}`;
            else message = req;
            if (typeof(message) === "object") message = JSON.stringify(message);
            if (req.type) switch (req.type) {
                case 'log':
                    await L.log(message);
                    break;
                case 'info':
                    await L.info(message);
                    break;
                case 'warn':
                    await L.warn(message);
                    break;
                case 'error':
                    await L.error(message);
                    break;
                default:
                    await L.log(message);
                    break;
            } else await L.log(message);

            switch (req.type) {
                case 'connected_notification':
                    await notify(lang.connected_notification.title.replace('%USERNAME%', req.info.userInfo), lang.connected_notification.body.replace('%TITLE%', req.info.title), req.info.img_Url, true);
                    break;
            }
        });

        socket.on('disconnect', async reason => {
            connectCounter--;
            await L.warn(`internal socket disconnected. reason : ${reason}`);
        });
    });

    internalHttpServer.listen(config.ws.Internal, async () => {
        await L.info(`internal websocket server is listening on : ${config.ws.Internal}`);
    });

    if (core === null && connectCounter === 0) { // Init
        await L.log('core is spawning...');
        core = child_process.exec(`cmd /c chcp 65001>nul && "${path.join(regList.InstallLocation.value, 'core', 'adobe-discord-rpc_core.exe')}"`, {env: {...process.env}}, async (err, stdout, stderr) => {
            if (err) await L.error(`An Error occurred while spawning core : ${err.toString()}`);
            if (stderr) await L.error(`Core thrown an Error : ${stderr.toString()}`);
        });
    }

    let checkOnline = setInterval(async () => {
        if (core === null || connectCounter === 0) { // Init
            await L.log('core is respawning...');
            core = child_process.exec(`cmd /c chcp 65001>nul && "${path.join(regList.InstallLocation.value, 'core', 'adobe-discord-rpc_core.exe')}"`, {env: {...process.env}}, async (err, stdout, stderr) => {
                if (err) await L.error(`An Error occurred while spawning core : ${err.toString()}`);
                if (stderr) await L.error(`Core thrown an Error : ${stderr.toString()}`);
            });
        } else if (core !== null && connectCounter === 0) { // 실행 중인진 모르겠고 연결 끊긴 경우
            try {
                core.kill();
                core = null;
            } catch {
                //
            }
        }
    }, 15000);
}

/* --------------------------------------------- */

ipcMain.on('getLang', async (event, res) => {
    if (res === 0 && fs.statSync(path.join(__dirname, 'web', 'lang', `${config.lang}.json`))) {
        event.returnValue = require(path.join(__dirname, 'web', 'lang', `${config.lang}.json`));
    } else if (typeof res === 'string' && fs.statSync(path.join(__dirname, 'web', 'lang', `${res}.json`))) {
        event.returnValue = require(path.join(__dirname, 'web', 'lang', `${res}.json`));
    } else event.returnValue = {};
});

const noConnectionAlert = async (lang, lev) => {
    await L.log('');
    await wait(3);
    await L.info('[noConnectionAlert() INIT]');
    await wait(3);
    await L.info(`lev : ${lev}`);

    NCA_win = new BrowserWindow({
        width: 1056,
        height: 594,
        title: "Screen Loading... - Adobe Discord RPC Monitor",
        icon: path.join(__dirname, 'img', 'monitor_fixed.png'),
        show: false,
        resizable: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        }
    });

    if (config.mode !== "Dev") {
        NCA_win.removeMenu();
    }

    NCA_win.loadFile(path.join(__dirname, 'web', 'noConnectionAlert.html'));

    // HTML 로드 끝나고 창 표시 -> 정보 Send
    NCA_win.once('ready-to-show', () => {
        NCA_win.show();

        NCA_win.webContents.send('lev-info', lev);
    });

    // 창닫기 방지
    NCA_win.on('close', async e => {
        e.preventDefault();
        NCA_win.webContents.executeJavaScript('M.Modal.getInstance(document.getElementById("cannotCancel")).open();').catch(async err => {
            if (err.toString() === "TypeError: Object has been destroyed") return;
            await L.warn("An expected error occurred in updateAlert() -> win.on('close') -> win.webContents.executeJavaScript()");
            await L.warn(err.toString());
        });
    });

    // 결과값 수신
    ipcMain.on('decided', async (event, arg) => {
        await L.log(`NCA -> Selected : ${arg}`);
        switch (arg) {
            case "Ignore":
                NCA_win.hide();
                NCA_win.destroy();
                await start();
                break;
            case "Retry":
                let reConnection = await checkConnection();
                await L.info(`NCA -> Returned : ${JSON.stringify(reConnection)}`);
                if (reConnection.result === "Success") {
                    NCA_win.hide();
                    NCA_win.destroy();
                    await checkUpdate();
                } else if (reConnection.result === "Fail") {
                    NCA_win.webContents.send('lev-info', reConnection.lev);
                } else {
                    NCA_win.webContents.send('lev-info', `${reConnection.lev}<br />Unknown result : ${reConnection.result}`);
                }
                break;
        }
    });
}

const updateAlert = async list => {
    await L.log('');
    await wait(3);
    await L.info('[updateAlert() INIT]');
    await wait(3);
    await L.info(`list : ${JSON.stringify(list)}`);

    UA_win = new BrowserWindow({
        width: 1056,
        height: 594,
        title: "Screen Loading... - Adobe Discord RPC Monitor",
        icon: path.join(__dirname, 'img', 'monitor_fixed.png'),
        show: false,
        resizable: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        }
    });

    if (config.mode !== "Dev") {
        UA_win.removeMenu();
    }

    UA_win.loadFile(path.join(__dirname, 'web', 'UpdateAlert.html'));

    // HTML 로드 끝나고 창 표시
    UA_win.once('ready-to-show', () => UA_win.show());

    // 업데이트 정보 요청
    ipcMain.on('getUpdates', (event, res) => event.returnValue = list);

    // 창닫기 방지
    UA_win.on('close', async e => {
        e.preventDefault();
        UA_win.webContents.executeJavaScript('document.getElementById("aft").style.display').then(async res => {
            if (res === "block") {
                UA_win.webContents.executeJavaScript('M.Modal.getInstance(document.getElementById("cancel")).open();').catch(async err => {
                    if (err.toString() === "TypeError: Object has been destroyed") return;
                    await L.warn("An expected error occurred in updateAlert() -> win.on('close') -> win.webContents.executeJavaScript()");
                    await L.warn(err.toString());
                });
            } else {
                UA_win.webContents.executeJavaScript('M.Modal.getInstance(document.getElementById("cannotCancel")).open();').catch(async err => {
                    if (err.toString() === "TypeError: Object has been destroyed") return;
                    await L.warn("An expected error occurred in updateAlert() -> win.on('close') -> win.webContents.executeJavaScript()");
                    await L.warn(err.toString());
                });
            }
        });
    });

    // 결과값 수신
    ipcMain.on('optionSelected', async (event, arg) => {
        await L.info(`UA -> optionSelected : ${arg}`);
        switch (arg) {
            case "Auto":
                UA_win.hide();
                await execProgram(`"${path.join(regList.InstallLocation.value, 'ADRPC_Controller.exe')}" --Configurator-Setup`);
                exit();
                break;
            case "Manual":
                UA_win.hide();
                shell.openExternal('https://adobe.discordrpc.org');
                //open('https://adobe.discordrpc.org');
                exit();
                break;
            case "Later":
                UA_win.hide();
                UA_win.destroy();
                start();
                break;
            // 2021-03-20: 버전 스킵 제거함
            //case "Skip":
            //    UA_win.hide();
            //    let ua = str.get('Update_Alert');
            //    // ua['updateSkipVersion'] 이거 업데이트 버전 남겨서 버전 체크로 넘길려고 하는데...... 악 모르겠다
            //    break;
        }
    });
}

const checkUpdate = async (force=false) => { // force -> true면 업데이트 있든 없든 그냥 창 띄우기
    await L.log('');
    await wait(3);
    await L.info('[checkUpdate() INIT]');
    await wait(3);
    await L.info(`force : ${force}`);
    let list;
    let AutoUpdate = true;

    let connection = await checkConnection();
    await L.info(`CU -> Returned : ${JSON.stringify(connection)}`);
    if (connection.result === "Fail") {
        await noConnectionAlert(config.lang, connection.lev);
        return; // 이 함수 내에서 더 이상 굴러가는 거 방지
    }

    // 버전 취득
    let core_version = ((regList['ADRPC:Core_Version'].value).split('('))[0];
    let monitor_version = ((regList['ADRPC:Monitor_Version'].value).split('('))[0];
    let info_version = (await str.get('RPCInfo_Official'))[0].version;
    let configurator_version = ((regList['ADRPC:Configurator_Version'].value).split('('))[0];
    let controller_version = ((regList['ADRPC:Controller_Version'].value).split('('))[0];

    // 릴리즈 취득
    let core_release = (((regList['ADRPC:Core_Version'].value).split('('))[1]).replace(')', '');
    let monitor_release = (((regList['ADRPC:Monitor_Version'].value).split('('))[1]).replace(')', '');
    let info_release = (await str.get('RPCInfo_Official'))[0].release;
    let configurator_release = (((regList['ADRPC:Configurator_Version'].value).split('('))[1]).replace(')', '');
    let controller_release = (((regList['ADRPC:Controller_Version'].value).split('('))[1]).replace(')', '');

    // 최신버전 List
    // TODO: 나중에 경로수정
    let core_latest = await request.getJson("https://cdn.discordrpc.org/2021050901/Core/index.json");
    let monitor_latest = await request.getJson("https://cdn.discordrpc.org/2021050901/Monitor/index.json");
    let info_latest = await request.getJson("https://cdn.discordrpc.org/2021050901/SupportFiles/index.json");
    let configurator_latest = await request.getJson("https://cdn.discordrpc.org/2021050901/Configurator/index.json");
    let controller_latest = await request.getJson("https://cdn.discordrpc.org/2021050901/Controller/index.json");

    // 업데이트 필요 여부
    if (
        parseFloat(core_release) < parseFloat(core_latest[config.mode].updated) ||
        parseFloat(monitor_release) < parseFloat(monitor_latest[config.mode].updated) ||
        parseFloat(info_release) < parseFloat(info_latest[config.mode].updated) ||
        parseFloat(configurator_release) < parseFloat(configurator_latest[config.mode].updated) ||
        parseFloat(controller_release) < parseFloat(controller_latest[config.mode].updated)
    ) {
        // Configurator에서 업데이트 가능한지 확인
        if (
            (parseFloat(core_latest[config.mode].Update_min) > parseFloat(core_version)) &&
            (parseFloat(monitor_latest[config.mode].Update_min) > parseFloat(monitor_version)) &&
            (parseFloat(info_latest[config.mode].Update_min) > parseFloat(info_version)) &&
            (parseFloat(configurator_latest[config.mode].Update_min) > parseFloat(configurator_version)) &&
            (parseFloat(controller_latest[config.mode].Update_min) > parseFloat(controller_version))
        ) AutoUpdate = false;
    
        list = {
            "Core": {
                "Update": parseFloat(core_release) < parseFloat(core_latest[config.mode].updated),
                "Link": core_latest[config.mode].info
            },
            "Monitor": {
                "Update": parseFloat(monitor_release) < parseFloat(monitor_latest[config.mode].updated),
                "Link": monitor_latest[config.mode].info
            },
            "PList": {
                "Update": parseFloat(info_release) < parseFloat(info_latest[config.mode].updated),
                "Link": info_latest[config.mode].info
            },
            "Configurator": {
                "Update": parseFloat(configurator_release) < parseFloat(configurator_latest[config.mode].updated),
                "Link": configurator_latest[config.mode].info
            },
            "Controller": {
                "Update": parseFloat(controller_release) < parseFloat(controller_latest[config.mode].updated),
                "Link": controller_latest[config.mode].info
            },
            AutoUpdate
        };
        await updateAlert(list);
    } else {
        await start();
    }
}

/*app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});*/

const execProgram = async query => { // 프로그램 실행
    child_process.exec(query, async (error, stdout, stderr) => {
        if (error) {
            await L.error(`exec ERR : ${error.toString()}`);
            await exit();
            return;
        }
    });
}

app.whenReady().then(async () => {
    // Electron Init
    app.setName('Adobe Discord RPC');
    app.setAppUserModelId('Adobe Discord RPC');

    // Init
    regList = await regedit.list('HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Adobe_Discord_RPC_NodePort');
    str = new storage(regList.InstallLocation.value);

    config = await str.get('Settings');
    L = new logger(regList.InstallLocation.value, `Monitor(${process.pid})`, config);

    // Logger Init
    let res = await L.init();
    if (!res) process.exit(1);

    // language load
    lang = require(path.join(__dirname, 'lang', `${config.lang}.json`));

    // 중복 실행 체크
    const externalIO_Client = socketCL.io(`ws://localhost:${config.ws.External}`);
    externalIO_Client.on('connect', async () => {
        //if (externalIO_Client.connected) {} // 2021-04-03: 이거 왜있음?
        await L.error('Another process is already running!!!');
        await exit(1);
    });
    externalIO_Client.on('connect_error', async () => { // 연결 안되면은 중복 실행 아닌거겠지 머,,
        externalIO_Client.close();

        // Check
        if (isEmpty(config)) {
            await L.error('Config is empty!');
            await exit(1);
        }
        if (config.mode !== "Dev" && config.mode !== "Pub") {await L.error("Unknown setting value : mode."); await exit(1);}
        if (config.lang !== "ko" && config.lang !== "en") {await L.error("Unknown setting value : lang."); await exit(1);}
        let arg = "";
        if (await fs.existsSync(path.join(regList.InstallLocation.value, 'run_args', 'Monitor.json'))) {
            try {
                arg = (require(path.join(regList.InstallLocation.value, 'run_args', 'Monitor.json')))['option'];
                await fs.unlinkSync(path.join(regList.InstallLocation.value, 'run_args', 'Monitor.json'));
            } catch (err) {
                await L.error(`Failed to read OR unlink argument : ${err.toString()}`);
                await exit(1);
            }
        }

        // Info Log
        await L.info('[Monitor INFO]');
        await wait(3);
        await L.info(`Release : v${version} (${release_date})`);
        await L.info(`Runtime : ${process.version}`);
        await L.info(`PID : ${process.pid}`);
        await L.info(`PPID : ${process.ppid}`);
        await L.info(`Language : ${config.lang}`);
        await L.info(`Mode : ${config.mode}`);
        await L.info(`Argument : ${arg}`);
        await wait(3);
        await L.log('');

        /* Monitor <-> external process (Installer/Configurator) */
        let externalIO = new socketIO.Server(externalHttpServer);

        externalIO.on('connection', async socket => {
            await L.info(`external socket connected - id : ${socket.id}`);

            socket.on('message', async req => {
                let message = '';
                if (req.message) message = `[${socket.id}] : ${req.message}`;
                else message = req;
                if (req.type) switch (req.type) {
                    case 'log':
                        await L.log(message);
                        break;
                    case 'info':
                        await L.info(message);
                        break;
                    case 'warn':
                        await L.warn(message);
                        break;
                    case 'error':
                        await L.error(message);
                        break;
                    default:
                        await L.log(message);
                        break;
                } else await L.log(message);

                switch (req.message) {
                    case 'exit':
                        await exit();
                        break;
                    case 'restart':
                        await L.info('restart');
                        await app.relaunch();
                        await exit();
                        break;
                    case 'restart-core':
                        if (core !== null) core.kill('SIGINT'); // 짜피 정상적인 상황에서는 실행 검증때문에 5초후에 켜짐
                        break;
                }
            });

            socket.on('disconnect', async reason => {
                await L.warn(`external socket is disconnected. reason : ${reason}`);
            });
        });

        externalHttpServer.listen(config.ws.External, async () => {
            await L.info(`external websocket server is listening on : ${config.ws.External}`);
        });
        /* E */

        // SYS Tray Init
        tray = new Tray(path.join(__dirname, 'img', 'monitor_fixed.png'));
        tray.setToolTip('Adobe Discord RPC Monitor');
        tray.setContextMenu(Menu.buildFromTemplate([
            {label: 'Adobe Discord RPC', enabled: false, icon: path.join(__dirname, 'img', 'icon_alpha_16_16.png')},
            {label: `${lang.tray.version} ${version} (${release_date})`, enabled: false},
            {type: 'separator'},
            //{label: lang.tray.homepage, click: () => open("https://adobe.discordrpc.org")},
            //{label: lang.tray.discord, click: () => open("https://discord.gg/7MBYbERafX")},
            {label: lang.tray.homepage, click: () => shell.openExternal("https://adobe.discordrpc.org")},
            {label: lang.tray.discord, click: () => shell.openExternal("https://discord.gg/7MBYbERafX")},
            {type: 'separator'},
            {label: lang.tray.checkUpdate, click: () => execProgram(`"${path.join(regList.InstallLocation.value, 'controller', 'ADRPC_Controller.exe')}" --Configurator-Setup`)},
            {label: lang.tray.programConfig, click: () => execProgram(`"${path.join(regList.InstallLocation.value, 'controller', 'ADRPC_Controller.exe')}" --Configurator-Update`)},
            {type: 'separator'},
            {label: lang.tray.exit, click: () => exit()}
        ]));

        // Args Check
        switch (arg) {
            case "Core":
                await start();
                break;
            case "forceUpdateAlert":
                await checkUpdate(true);
                break;
            default:
                await checkUpdate(false);
                //await noConnectionAlert(config.lang, 1); // 테스트
                break;
        }
    });
});
