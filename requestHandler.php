<?php
/** @var \UIOWA\EasyEdit\EasyEdit $module */

if ($_REQUEST['type'] == 'save') {
    echo $module->saveRedcapData($_REQUEST['pid'], file_get_contents('php://input'));
}
else if ($_REQUEST['type'] == 'piping') {
    echo Piping::replaceVariablesInLabel($_POST['label'], $_POST['record']);
}
else if ($_REQUEST['type'] == 'branching') {
    echo LogicTester::evaluateLogicSingleRecord($_POST['logic'], $_POST['record']);
}
elseif ($_REQUEST['type'] == 'getDataHistory') {
    echo json_encode(\Form::getDataHistoryLog($_POST['record_id'], $_POST['event_id'], $_POST['field'], $_POST['instance']));
}
elseif ($_REQUEST['type'] == 'getComments') {
    echo $module->getFieldComments($_POST['pid'], $_POST['record_id'], $_POST['field'], $_POST['instance']);
}
elseif ($_REQUEST['type'] == 'submitComment') {
    echo $module->submitFieldComment($_POST['record_id'], $_POST['field'], $_POST['event_id'], $_POST['instance'], $_POST['comment']);
}