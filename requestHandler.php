<?php
/** @var \UIOWA\EasyEdit\EasyEdit $module */

if ($_REQUEST['type'] == 'save') {
    echo $module->saveRedcapData($_REQUEST['pid'], file_get_contents('php://input'));
}
else if ($_POST['type'] == 'piping') {
    echo Piping::replaceVariablesInLabel($_POST['label'], $_POST['record']);
}
else if ($_POST['type'] == 'branching') {
    echo LogicTester::evaluateLogicSingleRecord($_POST['logic'], $_POST['record']);
}