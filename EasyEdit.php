<?php
namespace UIOWA\EasyEdit;

class EasyEdit extends \ExternalModules\AbstractExternalModule {

    public function includeJsAndCss() {
        ?>
        <script src="https://cdn.jsdelivr.net/npm/vue/dist/vue.js"></script>
        <script src="<?= $this->getUrl("resources/clipboard.min.js") ?>"></script>
        <script src="<?= $this->getUrl("resources/notify.js") ?>"></script>

        <script src="<?= $this->getUrl("EasyEdit.js") ?>"></script>
        <link href="<?= $this->getUrl("styles.css") ?>" rel="stylesheet" type="text/css"/>
        <?php
    }

    public function initializeVariables() {
        $pid = $_GET['pid'];

        $sql = "SELECT event_id FROM redcap_data WHERE project_id = $pid LIMIT 1";
        $result = db_query($sql);
        $eventId = db_fetch_assoc($result)['event_id'];

        $sql = "SELECT form_name, custom_repeat_form_label FROM redcap_events_repeat WHERE event_id = $eventId";
        $result = db_query($sql);
        $repeatingForms = array();

        while ($row = db_fetch_assoc($result)) {
            $repeatingForms[$row['form_name']] = $row['custom_repeat_form_label'];
        }

        $sql = "SELECT custom_record_label FROM redcap_projects WHERE project_id = $pid LIMIT 1";
        $result = db_query($sql);
        $recordLabel = trim(db_fetch_assoc($result)['custom_record_label'],'[]');

        $userRights = \REDCap::getUserRights(USERID)[USERID];

        $formRights = $userRights['forms'];

        $dataDictionary = \REDCap::getDataDictionary($pid, 'array');
        $formattedDataDictionary = array();

        $instruments = \REDCap::getInstrumentNames();
        $fields = array();

        //todo okay we shouldn't add this to the global data dictionary....should be per instrument
        foreach ($instruments as $uniqueName => $label) {
            $fields[$uniqueName] = \REDCap::getFieldNames($uniqueName);
//            $formattedDataDictionary[$uniqueName . '_complete'] = array(
//                "field_name" => $uniqueName . "_complete",
//                "field_type" => "status",
//                "field_label" => "Complete?",
//                "select_choices_or_calculations" => array('0' => 'Incomplete', '1' => 'Unverified', '2' => 'Complete'),
//                "section_header" => "Form Status"
//            );
        }

        foreach ($dataDictionary as $value) {
            if (in_array($value['field_type'], ['dropdown', 'checkbox', 'radio'])) {
                $value['select_choices_or_calculations'] = $this->getChoiceLabels($value['field_name']);
            }
            else if ($value['field_type'] == 'yesno') {
                $value['select_choices_or_calculations'] = array('1' => 'Yes', '0' => 'No');
                $value['field_type'] = 'radio';
            }
            else if ($value['field_type'] == 'truefalse') {
                $value['select_choices_or_calculations'] = array('1' => 'True', '0' => 'False');
                $value['field_type'] = 'radio';
            }

            $formattedDataDictionary[$value['field_name']] = $value;
        }

        $redcapData = \REDCap::getData(array('groups' => $userRights['group_id']));

        //todo probably add empty 'repeat_instance' arrays to all records here
//        foreach ($repeatingForms as $key => $value) {
//            if (!$redcapData[])
//        }

        if ($_GET['record']) {
            $selectedRecord = $_GET['record'];
        }
        else {
            if (!function_exists('array_key_first')) {
                function array_key_first(array $arr) {
                    foreach($arr as $key => $unused) {
                        return $key;
                    }
                    return NULL;
                }
            }

            $selectedRecord = array_key_first($redcapData);
        }

        $jsObject = array(
            'projectTitle' => \REDCap::getProjectTitle(),
            'instruments' => $instruments,
            'repeatingForms' => $repeatingForms,
            'fields' => $fields,
            'dataDictionary' => $formattedDataDictionary,
            'formRights' => $formRights,
            'redcapData' => $redcapData,
            'recordLabel' => $recordLabel,
            'eventId' => $eventId,
            'selectedRecordId' => $selectedRecord,
            'requestUrl' => $this->getUrl('requestHandler.php')
        )

        ?>
        <script>
            var UIOWA_EasyEdit = <?= json_encode($jsObject) ?>;
        </script>
        <?php
    }

    public function saveRedcapData($pid, $data)
    {
        $sql = "SELECT event_id FROM redcap_data WHERE project_id = $pid LIMIT 1";
        $result = db_query($sql);
        $eventId = db_fetch_assoc($result)['event_id'];

        $data = json_decode($data, true);
        $formattedData = array();

        foreach ($data as $recordId => $recordData) {
//            $recordData[$eventId]['record_id'] = $recordId;
            $recordData[$eventId] = $this->formatCheckboxFields($recordData[$eventId]);

            array_push($formattedData, $recordData[$eventId]);

            if (isset($recordData['repeat_instances'])) {
                foreach ($recordData['repeat_instances'][$eventId] as $key => $instances) {
                    foreach ($instances as $index => $instanceData) {
                        $formattedInstance = array(
                            'redcap_repeat_instrument' => $key,
                            'redcap_repeat_instance' => $index
                        );

                        $formattedInstance = array_merge($formattedInstance, $instanceData);
                        $formattedInstance = $this->formatCheckboxFields($formattedInstance);
                        $formattedInstance['record_id'] = $recordId;

                        array_push($formattedData, $formattedInstance);
                    }
                }
            }
        }

        // Get list of fields user should NOT be able to edit
//        $userRights = \REDCap::getUserRights(USERID)[USERID];
//        $formRights = $userRights['forms'];
//        $restrictedInstruments = array_keys(
//            array_filter($formRights, function($value) {
//                return $value == '0' || $value == '2';
//            })
//        );

//        $restrictedFields =

////
//        $formattedData = array();
//
//        foreach ($data as $record_id => $record) {
//            error_log($record_id);
//            $formattedData[$record_id] = $record[$eventId];
//        }

        error_log(print_r(json_encode($formattedData), JSON_PRETTY_PRINT));


        return json_encode(\REDCap::saveData('json', json_encode($formattedData)));
    }

    public function formatCheckboxFields($recordData) {
        foreach($recordData as $field => $value) {
            if (gettype($value) == 'array') {
                foreach ($value as $code => $choice) {
                    $recordData[$field . '___' . $code] = $choice;
                }

                unset($recordData[$field]);
            }
        }

        return $recordData;
    }
}