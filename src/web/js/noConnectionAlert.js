// 에러 레벨 수신 & HTML 변경
window.$ = $;

const decided = sel => {
    document.getElementById('bef').style.display = 'none';
    document.getElementById('aft').style.display = 'none';
    document.getElementById('cls').style.display = 'block';

    $('#Ignore').attr('disabled', false);
    document.getElementById('Reason0').style.display = 'none';
    document.getElementById('Reason1').style.display = 'none';
    document.getElementById('Reason21').style.display = 'none';
    document.getElementById('Reason22').style.display = 'none';
    document.getElementById('Reason22').innerHTML = 'NONE';

    ipcRenderer.send('decided', sel);
}

$(document).ready(function () {
    let lang = ipcRenderer.sendSync('getLang', 0);
    document.title = lang['noConnectionAlert']['htmlTitle'];
    $('#loading').html(lang['loading']);
    $('#Fail').html(lang['noConnectionAlert']['connectFail']);
    $('#Reason0').html(lang['noConnectionAlert']['Reason0']);
    $('#Reason1').html(lang['noConnectionAlert']['Reason1']);
    $('#Reason21').html(lang['noConnectionAlert']['Reason21']);
    $('#Ignore').html(lang['noConnectionAlert']['connectIgnore']);
    $('#Ignore').attr('data-tooltip', lang['noConnectionAlert']['connectIgnoreTooltip']);
    $('#Retry').html(lang['noConnectionAlert']['connectRetry']);
    $('#Retry').attr('data-tooltip', lang['noConnectionAlert']['connectRetryTooltip']);
    $('#Official').html(lang['noConnectionAlert']['connectOfficial']);
    $('#Official').attr('data-tooltip', lang['noConnectionAlert']['connectOfficialTooltip']);
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

    ipcRenderer.on('lev-info', (event, store) => {
        switch (store) {
            case 0:
                document.getElementById('Reason0').style.display = 'block';
                break;
            case 1:
                document.getElementById('Reason1').style.display = 'block';
                break;
            default:
                $('#Ignore').attr('disabled', true);
                document.getElementById('Reason21').style.display = 'block';
                document.getElementById('Reason22').style.display = 'block';
                document.getElementById('Reason22').innerHTML = `lev : ${store}`;
                break;
        }

        document.getElementById('bef').style.display = 'none';
        document.getElementById('aft').style.display = 'block';
        document.getElementById('cls').style.display = 'none';
    });
});