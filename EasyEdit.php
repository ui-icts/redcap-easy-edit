<?php
namespace UIOWA\EasyEdit;

require_once APP_PATH_DOCROOT . 'ProjectGeneral/form_renderer_functions.php';

class EasyEdit extends \ExternalModules\AbstractExternalModule {

    public function redcap_survey_page () {
        $_SESSION['username'] = $_POST['username'];

        ?>
        <script>
            var $saveButton = $('button[name="submit-btn-saverecord"]');
            var $saveReturnButton = $('button[name="submit-btn-savereturnlater"]');

            if ($saveReturnButton.length > 0) {
                $saveButton.hide();
                $saveReturnButton
                    .css({
                        'color': '#800000',
                        'width': '100%',
                        'max-width': '140px'
                    })
                    .html('Submit');

                $saveButton = $saveReturnButton;
            }

            $saveButton.click(function() {
                window.parent.location.reload();
            });
        </script>
        <?php
    }

    public function redcap_module_link_check_display($project_id, $link) {
        if ($_GET['id']) {
            $link['url'] .= '&record=' . $_GET['id'];
        }

        return $link;
    }

    public function includeJsAndCss() {
        ?>
        <script src="https://cdn.jsdelivr.net/npm/vue/dist/vue.js"></script>
        <script src="<?= $this->getUrl("resources/clipboard.min.js") ?>"></script>
        <script src="<?= $this->getUrl("resources/notify.js") ?>"></script>

        <script src="<?= $this->getUrl("EasyEdit.js") ?>"></script>
        <link href="<?= $this->getUrl("styles.css") ?>" rel="stylesheet" type="text/css"/>

        <script src="https://unpkg.com/docx@4.0.0/build/index.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.8/FileSaver.js"></script>
        <?php
    }

    public function initializeVariables() {
        $pid = $_GET['pid'];

        if ($_GET['record']) {
            $recordId = $_GET['record'];
        }
        else {
            $recordId = $this->getRecordId();
        }

        // todo support longitudinal? (multiple event_id)
        $sql = "SELECT event_id FROM redcap_data WHERE project_id = $pid LIMIT 1";
        $result = db_query($sql);
        $eventId = db_fetch_assoc($result)['event_id'];

        // get names of repeatable forms
        $sql = "SELECT form_name, custom_repeat_form_label FROM redcap_events_repeat WHERE event_id = $eventId";
        $result = db_query($sql);
        $repeatingForms = array();
        while ($row = db_fetch_assoc($result)) {
            $repeatingForms[$row['form_name']] = $row['custom_repeat_form_label'];
        }

        // get record labels for "Viewing Record" display
        $sql = "SELECT custom_record_label FROM redcap_projects WHERE project_id = $pid LIMIT 1";
        $result = db_query($sql);
        $recordLabel = trim(db_fetch_assoc($result)['custom_record_label'],'[]');

        // get user rights to show/hide forms based on access
        $userRights = \REDCap::getUserRights(USERID)[USERID];
        $formRights = $userRights['forms'];

        // get project metadata
        $dataDictionary = \REDCap::getDataDictionary($pid, 'array');
        $instruments = \REDCap::getInstrumentNames();

        // get record data
        $redcapData = \REDCap::getData(array(
            'records' => $recordId,
            'groups' => $userRights['group_id']
        ));

        $formattedDataDictionary = array();
        $repeatSurveys = array();
        $formMetadata = array();
        $branchingFields = array();
        $fileFields = array();

        // make some edits to data dictionary
        foreach ($dataDictionary as $key => $value) {
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
            else if ($value['field_type'] == 'file') {
                array_push($fileFields, $value['field_name']);
            }

            if ($value['branching_logic'] !== '') {
                $branchingFields[$key] = $value['branching_logic'];
            }

            $actionTags = array();

            if (\Form::hasHiddenOrHiddenSurveyActionTag($value['field_annotation'])) {
                $actionTags['hidden'] = true;
            }

            $formattedDataDictionary[$key]['action_tags'] = $actionTags;

            $formattedDataDictionary[$key] = $value;
        }

        // update top level data
        foreach ($redcapData[$recordId][$eventId] as $field => $value) {
            if (in_array($field, $fileFields)) {
                $redcapData[$recordId][$eventId][$field] = $this->getFileUploadDetails($value, $pid, $recordId, $eventId, $field);
            }

            if (in_array($field, $branchingFields)) {
                $visible = \REDCap::evaluateLogic($branchingFields[$field], $pid, $recordId);

                if (!$visible) {
                    $redcapData[$recordId][$eventId][$field] = false;
                }
            }
        }

        // todo could call for dynamic branching?
//        error_log(json_encode(getDependentFields(array_keys($dataDictionary))));

        // update repeatable instrument data
        foreach ($redcapData[$recordId]['repeat_instances'][$eventId] as $formName => $instances) {
            $surveys = array();
            $lastRepeatIndex = 1;

            foreach ($instances as $repeatIndex => $data) {
                foreach ($data as $field => $value) {
                    if (in_array($field, $fileFields)) {
                        $redcapData[$recordId]['repeat_instances'][$eventId][$formName][$repeatIndex][$field] = $this->getFileUploadDetails($value, $pid, $recordId, $eventId, $field, $repeatIndex);
                    }

                    if (in_array($field, $branchingFields)) {
                        $visible = \REDCap::evaluateLogic($branchingFields[$field], $pid, $recordId);

                        if (!$visible) {
                            $redcapData[$recordId]['repeat_instances'][$eventId][$formName][$repeatIndex][$field] = false;
                        }
                    }
                }

                $surveys[$repeatIndex] = \REDCap::getSurveyLink($recordId, $formName, $eventId, $repeatIndex);

                $lastRepeatIndex = $repeatIndex;
            }

            // add one extra survey for "Add New" button
            $surveys['new'] = \REDCap::getSurveyLink($recordId, $formName, $eventId, $lastRepeatIndex + 1);

            if (!$surveys['new']) {
                $surveys = null;
            }

            $repeatSurveys[$formName] = $surveys;
        }

        // get survey settings
        $surveySettings = array();
        $sql = "select form_name, edit_completed_response from redcap_surveys where project_id = $pid";
        $result = db_query($sql);
        while ($row = db_fetch_assoc($result)) {
            $surveySettings[$row['form_name']] = $row['edit_completed_response'];
        }

        foreach ($instruments as $uniqueName => $label) {
            if (array_key_exists($uniqueName, $repeatSurveys)) {
                $formSurvey = $repeatSurveys[$uniqueName];
            }
            else {
                $formSurvey = \REDCap::getSurveyLink($recordId, $uniqueName, $eventId);
            }

            $formMetadata[$uniqueName] = array(
                'fields' => \REDCap::getFieldNames($uniqueName),
                'survey' => $formSurvey,
                'modifyCompleted' => $surveySettings[$uniqueName]
            );

            //todo keep this with weird survey statuses?
//            $formattedDataDictionary[$uniqueName . '_complete'] = array(
//                "field_name" => $uniqueName . "_complete",
//                "field_type" => "status",
//                "field_label" => "Complete?",
//                "select_choices_or_calculations" => array('0' => 'Incomplete', '1' => 'Unverified', '2' => 'Complete'),
//                "section_header" => "Form Status"
//            );
        }

        // get initial comment counts
        $commentCounts = array();
        if ($this->getProjectSetting('comment-buttons-enabled')) {
            $repeatLookup = array();
            foreach ($repeatingForms as $form) {
                array_push($repeatLookup, $form['form_name']);
            }

            $sql = "select field_name, instance
                    from redcap_data_quality_resolutions as rdqr
                    left join redcap_data_quality_status rdqs on rdqr.status_id = rdqs.status_id
                    where project_id = $pid and record = $recordId";
            $result = db_query($sql);

            while ($row = db_fetch_assoc($result)) {
                if ($row['instance'] > 1) {
                    $formattedFieldName = $row['field_name'] . '__' . $row['instance'];
                }
                else {
                    $formattedFieldName = $row['field_name'];
                }

                $commentCounts[$formattedFieldName]++;
            }
        }

        // make data/config/etc available client-side
        $jsObject = array(
            'projectTitle' => \REDCap::getProjectTitle(),
            'instruments' => $instruments,
            'repeatingForms' => $repeatingForms,
            'branchingFields' => $branchingFields,
            'formMetadata' => $formMetadata,
            'dataDictionary' => $formattedDataDictionary,
            'formRights' => $formRights,
            'redcapData' => $redcapData,
            'recordLabel' => $recordLabel,
            'projectId' => PROJECT_ID,
            'eventId' => $eventId,
            'selectedRecordId' => $recordId,
            'requestUrl' => $this->getUrl('requestHandler.php'),
            'commentCounts' => $commentCounts,
            'lastRequestData' => array(),
            'loggedInUser' => USERID,
            'redcapVersionUrl' => (isset($_SERVER['HTTPS']) ? 'https://' : 'http://') . SERVER_NAME . APP_PATH_WEBROOT,
            'newAlertsSupported' => \REDCap::versionCompare(REDCAP_VERSION, '9.7.3', 'ge'),
            'config' => array(
                'commentButtons' => $this->getProjectSetting('comment-buttons-enabled'),
                'copyButtons' => $this->getProjectSetting('copy-buttons-enabled'),
                'downloadButtons' => $this->getProjectSetting('download-buttons-enabled'),
                'historyButtons' => $this->getProjectSetting('history-buttons-enabled')
            )
//            'logicTesterExample' => \LogicTester::apply('[core] = 2', $redcapData[$selectedRecord])
        )

        ?>
        <script>
            UIOWA_EasyEdit = Object.assign(UIOWA_EasyEdit, <?= json_encode($jsObject) ?>);

            document.title = UIOWA_EasyEdit.projectTitle + ' - Easy Edit';
        </script>
        <?php
    }

    // not required after switch to surveys
//    public function saveRedcapData($pid, $data)
//    {
//        $sql = "SELECT event_id FROM redcap_data WHERE project_id = $pid LIMIT 1";
//        $result = db_query($sql);
//        $eventId = db_fetch_assoc($result)['event_id'];
//
//        $data = json_decode($data, true);
//        $formattedData = array();
//
//        foreach ($data as $recordId => $recordData) {
////            $recordData[$eventId]['record_id'] = $recordId;
//            $recordData[$eventId] = $this->formatCheckboxFields($recordData[$eventId]);
//
//            array_push($formattedData, $recordData[$eventId]);
//
//            if (isset($recordData['repeat_instances'])) {
//                foreach ($recordData['repeat_instances'][$eventId] as $key => $instances) {
//                    foreach ($instances as $index => $instanceData) {
//                        $formattedInstance = array(
//                            'redcap_repeat_instrument' => $key,
//                            'redcap_repeat_instance' => $index
//                        );
//
//                        $formattedInstance = array_merge($formattedInstance, $instanceData);
//                        $formattedInstance = $this->formatCheckboxFields($formattedInstance);
//                        $formattedInstance['record_id'] = $recordId;
//
//                        array_push($formattedData, $formattedInstance);
//                    }
//                }
//            }
//        }
//
//        // Get list of fields user should NOT be able to edit
////        $userRights = \REDCap::getUserRights(USERID)[USERID];
////        $formRights = $userRights['forms'];
////        $restrictedInstruments = array_keys(
////            array_filter($formRights, function($value) {
////                return $value == '0' || $value == '2';
////            })
////        );
//
////        $restrictedFields =
//
//////
////        $formattedData = array();
////
////        foreach ($data as $record_id => $record) {
////            error_log($record_id);
////            $formattedData[$record_id] = $record[$eventId];
////        }
//
////        error_log(print_r(json_encode($formattedData), JSON_PRETTY_PRINT));
//
//
//        return json_encode(\REDCap::saveData('json', json_encode($formattedData)));
//    }

//    public function formatCheckboxFields($recordData) {
//        foreach($recordData as $field => $value) {
//            if (gettype($value) == 'array') {
//                foreach ($value as $code => $choice) {
//                    $recordData[$field . '___' . $code] = $choice;
//                }
//
//                unset($recordData[$field]);
//            }
//        }
//
//        return $recordData;
//    }

    public function getFieldComments($pid, $selectedRecord, $field, $instance) {
        $sql = "select ts, username, comment from redcap_data_quality_resolutions as rdqr
                left join redcap_data_quality_status rdqs on rdqr.status_id = rdqs.status_id
                left join redcap_user_information rui on rdqr.user_id = rui.ui_id
                where project_id = $pid and record = $selectedRecord and field_name = '$field' and instance = $instance
                order by ts";

        $result = db_query($sql);
        $comments = array();

        while ($row = db_fetch_assoc($result)) {
            array_push($comments, $row);
        }

        // add blank comment with current time for user input
        array_push($comments, array(
                'ts' => NOW,
                'username' => USERID,
                'comment' => ''
        ));

        return json_encode($comments);
    }

    public function submitFieldComment($record, $field, $event_id, $instance, $comment) {
        $record = 1;
        $field = 'core';
        $event_id = 163;
        $instance = 1;
        $comment = 'test friday';

        $sql = "
            insert into redcap_data_quality_status (
                non_rule,
                project_id,
                record,
                event_id,
                field_name,
                instance
            ) values (
                1,
                ".PROJECT_ID.",
                '".db_escape($record)."',
                '".db_escape($event_id)."',
                ".checkNull($field).",
                '".db_escape($instance)."'
            )
			on duplicate key update query_status = null, status_id = LAST_INSERT_ID(status_id)";

        error_log($sql);

        if (db_query($sql)) {
            // Get cleaner_id
            $status_id = db_insert_id();
            // Get current user's ui_id
            $userInitiator = \User::getUserInfo(USERID);
            // Add new row to data_resolution_log
            $sql = "insert into redcap_data_quality_resolutions (
                status_id,
                ts,
                user_id,
                response_requested,
                comment
            ) values (
                $status_id,
                '".NOW."',
                ".checkNull($userInitiator['ui_id']).",
				0,
				".checkNull(trim(label_decode($comment)))."
            )";

            error_log($sql);

            return $sql;
        }
        else {
            return ('something went wrong');
        }
    }

    public function getFileUploadDetails($docId, $pid, $recordId, $eventId, $field, $instance=1) {
        $hash = \Files::docIdHash($docId);

        $link = APP_PATH_WEBROOT .
            "DataEntry/file_download.php" .
            "?pid=$pid" .
            "&doc_id_hash=$hash" .
            "&id=$docId" .
            "&record=$recordId" .
            "&event_id=$eventId" .
            "&field_name=$field" .
            "&instance=$instance";

        $sql = "select doc_name from redcap_edocs_metadata where doc_id = $docId";
        $result = db_query($sql);
        $docName = db_fetch_assoc($result)['doc_name'];

        return array(
            'filename' => $docName,
            'link' => $link
        );
    }

    public function getRecordId() {
        $rights = \REDCap::getUserRights(USERID);

        // Check if the user is in a data access group (DAG)
        $group_id = $rights[USERID]['group_id'];

        $records = \Records::getRecordList(PROJECT_ID, $group_id);

        return reset($records); //todo test with DAG
    }
}