const closeWindow = select => { // Select : Auto / Manual / Later / Skip
    document.getElementById('aft').style.display = 'none';
    document.getElementById('cls').style.display = 'block';
    if (select === "Auto" || select === "Manual" || select === "Later" || select === "Skip") {
        ipcRenderer.send('optionSelected', select);
    } else {
        M.Modal.getInstance(document.getElementById('linkNF')).open();
        document.getElementById('cls').style.display = 'none';
        document.getElementById('aft').style.display = 'block';
    }
}

$(document).ready(function () {
    let lang = ipcRenderer.sendSync('getLang', 0);
    document.title = lang['UpdateAlert']['htmlTitle'];
    $('#loading').html(lang['loading']);
    $('#title').html(lang['UpdateAlert']['title']);
    let desc = lang['UpdateAlert']['description_top'];
    for (let item of lang['UpdateAlert']['list']) {
        desc += item;
    }
    desc += lang['UpdateAlert']['description_bottom'];
    $('#description').html(desc);
    $('#AutoUpdate').html(lang['UpdateAlert']['autoUpdate']);
    $('#AutoUpdate').attr('data-tooltip', lang['UpdateAlert']['autoUpdateTooltip']);
    $('#ManualUpdate').html(lang['UpdateAlert']['manualUpdate']);
    $('#ManualUpdate').attr('data-tooltip', lang['UpdateAlert']['manualUpdateTooltip']);
    $('#OpenCancel').html(lang['UpdateAlert']['openCancel']);
    $('#OpenCancel').attr('data-tooltip', lang['UpdateAlert']['openCancelTooltip']);
    $('#processing').html(lang['processing']);

    $('#lo-title').html(lang['modal']['linkOpened']['title']);
    $('#lo-description0').html(lang['modal']['linkOpened']['description'][0]);
    $('#lo-description1').html(lang['modal']['linkOpened']['description'][1]);
    $('#lo-tooltip').attr('data-tooltip', lang['modal']['linkOpened']['input']['tooltip']);
    $('#linkOpenURL').attr('value', lang['modal']['linkOpened']['input']['value']);
    $('#lo-close').html(lang['modal']['linkOpened']['close']);
    $('#nf-title').html(lang['modal']['linkNF']['title']);
    $('#nf-description').html(lang['modal']['linkNF']['description']);
    $('#nf-close').html(lang['modal']['linkNF']['close']);
    $('#cc-title').html(lang['modal']['cannotCancel']['title']);
    $('#cc-description').html(lang['modal']['cannotCancel']['description']);
    $('#cc-close').html(lang['modal']['cannotCancel']['close']);
    
    $('#can-title').html(lang['UpdateAlert']['cancel']['title']);
    $('#can-description').html(lang['UpdateAlert']['cancel']['description']);
    $('#can-official').html(lang['UpdateAlert']['cancel']['official_discord']);
    $('#can-later').html(lang['UpdateAlert']['cancel']['later']);
    $('#can-later').attr('data-tooltip', lang['UpdateAlert']['cancel']['laterTooltip']);
    $('#can-skip').html(lang['UpdateAlert']['cancel']['skip']);
    $('#can-skip').attr('data-tooltip', lang['UpdateAlert']['cancel']['skipTooltip']);
    $('#can-back').html(lang['UpdateAlert']['cancel']['back']);

    // 업데이트 정보 수신 & HTML 변경
    let Udata = ipcRenderer.sendSync('getUpdates', 0);
    if (Udata.AutoUpdate) $('#AutoUpdate').attr('disabled', false);
    else $('#AutoUpdate').attr('disabled', true);

    let Core = 'undefined', Monitor = 'undefined', PList = 'undefined', Configurator = 'undefined', Controller = 'undefined';
    if (Udata.Core.Link !== null) Core = Udata.Core.Link;
    if (Udata.Monitor.Link !== null) Monitor = Udata.Monitor.Link;
    if (Udata.PList.Link !== null) PList = Udata.PList.Link;
    if (Udata.Configurator.Link !== null) Configurator = Udata.Configurator.Link;
    if (Udata.Controller.Link !== null) Controller = Udata.Controller.Link;

    $('#Core').attr("onclick", `openLink('${Core}', false);`);
    $('#Monitor').attr("onclick", `openLink('${Monitor}', false);`);
    $('#PList').attr("onclick", `openLink('${PList}', false);`);
    $('#Configurator').attr("onclick", `openLink('${Configurator}', false);`);
    $('#Controller').attr("onclick", `openLink('${Controller}', false);`);

    if (Udata.Core.Update) document.getElementById('Core').style.display = 'block';
    if (Udata.Monitor.Update) document.getElementById('Monitor').style.display = 'block';
    if (Udata.PList.Update) document.getElementById('PList').style.display = 'block';
    if (Udata.Configurator.Update) document.getElementById('Configurator').style.display = 'block';
    if (Udata.Controller.Update) document.getElementById('Controller').style.display = 'block';

    document.getElementById('bef').style.display = 'none';
    document.getElementById('aft').style.display = 'block';
});