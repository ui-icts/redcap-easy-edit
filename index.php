<?php
/** @var \UIOWA\EasyEdit\EasyEdit $module */

$page = new HtmlPage();
$page->PrintHeaderExt();

$module->includeJsAndCss();
$module->initializeVariables();

?>
<script type="text/x-template" id="cardHeader">
    <div
        class="card-header"
        :id="'heading_' + name + (index ? repeatSuffix(index) : '')"
        :data-target="'#collapse_' + name + (index ? repeatSuffix(index) : '')"
        :class="{
            'incomplete': (index ? complete : getOverallStatus(name)) === '0',
            'unverified': (index ? complete : getOverallStatus(name)) === '1',
            'complete': (index ? complete : getOverallStatus(name)) === '2',
            'mixed': (index ? complete : getOverallStatus(name)) === '3'
        }"
        data-toggle="collapse"
        style="display: table"
    >
        <div style="display: table-cell">
            <h5 class="mb-0" style="float: left; vertical-align: middle">
            <span
                    class="accordion-header"
                    aria-expanded="true"
                    :aria-controls="'collapse_' + name"
                    style="display: table-cell; vertical-align: middle"
            >
                {{ formatText(label, record) }}
                <span
                        v-if="isRepeatingForm(name) && !index"
                        class="badge"
                        :class="{
                        'badge-secondary': getOverallStatus(name) === '',
                        'badge-danger': getOverallStatus(name) === '0',
                        'badge-warning': getOverallStatus(name) === '1',
                        'badge-success': getOverallStatus(name) === '2',
                        'badge-primary': getOverallStatus(name) === '3'
                    }"
                >
                    {{ getRepeatInstanceCount(name) }}
                </span>
            </span>
            </h5>
            <div class="no-collapse" style="float: right">
<!--                <button class="btn btn-primary save-button" style="float: right">-->
<!--                    <i class="fas fa-save"></i>-->
<!--                </button>-->
                <button class="btn btn-primary edit-button" v-if="!isRepeatingForm(name) || index" :data-edit="name" :data-repeat-index="index">
                    <i class="fas fa-edit fa-fw"></i>
                </button>
                <button style="display: none" class="btn btn-danger cancel-button" v-if="!isRepeatingForm(name) || index" :data-edit="name" :data-repeat-index="index">
                    <i class="fas fa-times fa-fw"></i>
                </button>
            </div>
        </div>
    </div>
</script>

<script type="text/x-template" id="cardCollapse">
    <div :id="'collapse_' + name + (index ? repeatSuffix(index) : '')" class="collapse" :aria-labelledby="'heading_' + name">
        <div class="card-body redcap-form-content" :data-edit="name + (index ? repeatSuffix(index) : '')">
            <div v-for="field in fields">
                <div v-if="field == name + '_complete'">
                    <div class="section-header border rounded">
                        <div :id="'section_header-' + name + + '_complete' + repeatSuffix(index)">Form Status</div>
                    </div>
                    <div class="form-inline field border rounded">
                        <h5 class="field-label">Complete?</h5>
                        <div class="field-content">
                            <select
                                :id="'edit-' + name + '_complete' + repeatSuffix(index)"
                                :data-name="name + '_complete' + repeatSuffix(index)"
                                v-model="record[name + '_complete']"
                                class="form-control"
                                type="select"
                                disabled="disabled"
                            >
                                <option value="0">Incomplete</option>
                                <option value="1">Unverified</option>
                                <option value="2">Complete</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div v-else>
                    <div v-if="dictionary[field]['section_header'] !== ''" class="section-header border rounded">
                        <div :id="'section_header-' + field + repeatSuffix(index)" v-html="formatText(dictionary[field]['section_header'], record)"></div>
                    </div>
                    <div v-if="dictionary[field]['field_type'] == 'descriptive'" class="field descriptive border rounded">
                        <div :id="'view-' + field + repeatSuffix(index)" v-html="formatText(dictionary[field]['field_label'], record)"></div>
                    </div>
                    <div v-else class="form-inline field border rounded">
                        <h5 v-html="formatText(dictionary[field]['field_label'], record)" class="field-label"></h5>
                        <div class="field-buttons" v-if="field !== 'record_id' && field !== name + '_complete'">
                            <button v-if="config['copyButtons']" class="btn btn-secondary copy-button" :data-clipboard-target="dictionary[field]['field_type'] == 'dropdown' ? choiceToLabel(record[field], field) : '#' + 'edit-' + field + repeatSuffix(index)">
                                <i class="far fa-clipboard fa-fw"></i>
                            </button>
                            <button v-if="dictionary[field]['field_type'] == 'notes' && config['downloadButtons']" class="btn btn-success download-button" :data-edit="field + repeatSuffix(index)">
                                <i class="fa fa-file-download fa-fw"></i>
                            </button>
<!--                            <button v-if="dictionary[field]['field_note'] !== ''" class="btn btn-info" :data-edit="field + repeatSuffix(index)" data-toggle="popover" data-container="body" :data-content="dictionary[field]['field_note']" data-placement="top">-->
<!--                                <i class="fas fa-question fa-fw"></i>-->
<!--                            </button>-->
                            <button v-if="config['historyButtons']" class="btn btn-warning history-button" :data-edit="field + repeatSuffix(index)" :data-instance="index">
                                <i class="fas fa-history fa-fw"></i>
                            </button>
                            <button class="btn btn-primary show-comments" :data-edit="field + repeatSuffix(index)" :data-instance="index" v-if="getFormRights(name) != 2 && config['commentButtons']"">
                                <i class="far fa-comment fa-fw"></i>
                                <span class="badge badge-light comment-count"></span>
                            </button>
                        </div>
                        <div v-if="dictionary[field]['field_type'] == 'text'" class="field-content">
                            <input
                                    :id="'edit-' + field + repeatSuffix(index)"
                                    :data-name="field + repeatSuffix(index)"
                                    v-model="record[field]"
                                    class="form-control"
                                    :class="{locked: field == 'record_id'}"
                                    type="text"
                                    readonly="readonly"
                                    style="width: 100%"
                            >
                        </div>
                        <div v-else-if="dictionary[field]['field_type'] == 'notes'" class="field-content">
                        <textarea
                                :id="'edit-' + field + repeatSuffix(index)"
                                :data-name="field + repeatSuffix(index)"
                                v-model="record[field]"
                                class="form-control"
                                type="textarea"
                                readonly="readonly"
                                style="width: 100%"
                                rows="10"
                        ></textarea>
                        </div>
                        <div v-else-if="dictionary[field]['field_type'] == 'dropdown'" class="field-content">
                            <select
                                    :id="'edit-' + field + repeatSuffix(index)"
                                    :data-name="field + repeatSuffix(index)"
                                    v-model="record[field]"
                                    class="form-control"
                                    type="select"
                                    disabled="disabled"
                                    style="width: 100%"
                            >
                                <option v-for="(choice, code) in dictionary[field]['select_choices_or_calculations']" :value="code">
                                    {{ choice }}
                                </option>
                            </select>
                        </div>
                        <div v-else-if="dictionary[field]['field_type'] == 'radio'" class="field-content">
                            <div :id="'edit-' + field + repeatSuffix(index)">
                                <div v-for="(choice, code) in dictionary[field]['select_choices_or_calculations']" class="form-check">
                                    <input
                                            :id="field + code + repeatSuffix(index)"
                                            :name="field + code + repeatSuffix(index)"
                                            :data-name="field + repeatSuffix(index)"
                                            :value="code"
                                            type="radio"
                                            :checked="code == record[field] ? 'checked' : ''"
                                            v-model="record[field]"
                                            class="form-check-input"
                                            disabled="disabled"
                                    >
                                    <label class="form-check-label" :for="field + code">
                                        {{ choice }}
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div v-else-if="dictionary[field]['field_type'] == 'checkbox'" class="field-content">
                            <div :id="'edit-' + field + repeatSuffix(index)">
                                <div v-for="(choice, code) in dictionary[field]['select_choices_or_calculations']" class="form-check">
                                    <input
                                            :id="field + code + repeatSuffix(index)"
                                            :name="field + code + repeatSuffix(index)"
                                            :data-name="field + repeatSuffix(index)"
                                            type="checkbox"
                                            :true-value="'1'"
                                            :false-value="'0'"
                                            v-model="record[field][code]"
                                            class="form-check-input"
                                            disabled="disabled"
                                    >
                                    <label class="form-check-label" :for="field + code + repeatSuffix(index)">
                                        {{ choice }}
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div v-else-if="dictionary[field]['field_type'] == 'file'" class="field-content">
                            <div :id="'edit-' + field + repeatSuffix(index)">
                                <input type="hidden" name="test" value="">
                                <a target="_blank" class="filedownloadlink" name="test" tabindex="0" href="/redcap/redcap_v9.3.0/DataEntry/file_download.php?pid=13&amp;doc_id_hash=1f0c8c24527ec7bbf6bc8d1615fe85d2051e2a2c&amp;id=10&amp;s=&amp;record=1&amp;page=reporting&amp;event_id=40&amp;field_name=test&amp;instance=1" onclick="return appendRespHash('test');" id="test-link" style="text-align: right; font-weight: normal; display: none; text-decoration: underline; margin: 0px 10px; position: relative;">NLP_communication (1).docx (0.03 MB)</a>
                                <div style="font-weight:normal;margin:10px 5px 0 0;position:relative;text-align:right;" id="test-linknew">
                                    <a href="javascript:;" class="fileuploadlink" onclick="filePopUp('test',0,0);return false;">
                                        <i class="fas fa-upload mr-1 fs12"></i>Upload file
                                    </a>
                                </div>
                            </div>
                        </div>
                        <div v-if="dictionary[field]['field_note'] !== ''" class="note" style="margin: ">
                            {{ dictionary[field]['field_note'] }}
                        </div>
                    </div>
                </div>
            </div>
            <div style="text-align: center">
                <button class="btn btn-primary edit-button edit-collapse" v-if="!isRepeatingForm(name) || index" :data-edit="name" :data-repeat-index="index">
                    <i class="fas fa-edit fa-fw"></i><span> Edit</span>
                </button>
                <button style="display: none" class="btn btn-danger cancel-button" v-if="!isRepeatingForm(name) || index" :data-edit="name" :data-repeat-index="index">
                    <i class="fas fa-times fa-fw"></i><span> Discard Changes</span>
                </button>
            </div>
        </div>
    </div>
</script>
<div id="app">
    <div v-cloak>
        <a :href="redcapVersionUrl + 'ProjectSetup/index.php?pid=' + projectId" target="_blank">
            <h2 style="text-align: center; color: #106CD6; font-weight: bold; padding-bottom: 20px">
                {{ projectTitle }}
            </h2>
        </a>

        <div style="text-align: center">
            <label for="recordSelect">Viewing Record</label>
            <select v-if="Object.keys(redcapData).length > 1" id="recordSelect" class="form-control btn-light-danger" v-model="selectedRecordId">
                <option v-for="(recordData, recordId) in redcapData" :value="recordId">
                    {{ recordId + ' - ' + choiceToLabel(redcapData[recordId][eventId][recordLabel], recordLabel) }}
                </option>
            </select>
            <span v-else>
                {{ selectedRecordId + ' - ' + choiceToLabel(redcapData[selectedRecordId][eventId][recordLabel], recordLabel) }}
            </span>
        </div>
        <br/>
        <div class="progress">
            <div class="progress-bar bg-success" role="progressbar" :style="'width:' + getProgressPercentage('complete')">
            </div>
            <div class="progress-bar bg-warning" role="progressbar" :style="'width:' + getProgressPercentage('unverified')">
            </div>
            <div class="progress-bar bg-danger" role="progressbar" :style="'width:' + getProgressPercentage('incomplete')">
            </div>
        </div>
        <br/>
        <div style="text-align: center; padding: 5px;">
            <button id="expandAll" class="btn btn-success">Expand All</button>
            <button id="collapseAll" class="btn btn-primary">Collapse All</button>
        </div>
        <div id="accordion">
            <div class="card" v-for="(formLabel, formName, index) in instruments" v-if="getFormRights(formName) != 0">
                <card-header
                    :name="formName"
                    :label="formLabel"
                    :complete="redcapData[selectedRecordId][eventId][formName + '_complete']"
                    :survey="formMetadata[formName]['survey']"
                ></card-header>
                <div
                    v-if="isRepeatingForm(formName)"
                    :id="'collapse_' + formName"
                    class="collapse"
                    :aria-labelledby="'heading_' + formName"
                >
                    <div class="card-body">
                        <div
                            :id="'accordion_' + formName"
                        >
                            <div
                                class="card"
                                v-for="(recordData, repeatIndex) in redcapData[selectedRecordId]['repeat_instances'][eventId][formName]"
                                :key="repeatIndex"
                            >
                                <card-header
                                    :index="repeatIndex"
                                    :record="recordData"
                                    :name="formName"
                                    :label="repeatingForms[formName] || 'Instance #' + repeatIndex"
                                    :complete="recordData[formName + '_complete']"
                                ></card-header>
                                <card-collapse
                                    :record="recordData"
                                    :index="repeatIndex"
                                    :name="formName"
                                    :label="formLabel"
                                    :fields="formMetadata[formName]['fields']"
                                    :dictionary="dataDictionary"
                                    :config="config"
                                ></card-collapse>
                            </div>
                            <div style="float: right; margin: 20px;">
                                <button class="btn btn-primary edit-button add-new-instance" :data-edit="formName">
                                    <i class="fas fa-plus"></i>
                                    Add New
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <card-collapse v-else
                    :record="redcapData[selectedRecordId][eventId]"
                    :name="formName"
                    :label="formLabel"
                    :fields="formMetadata[formName]['fields']"
                    :dictionary="dataDictionary"
                    :config="config"
                ></card-collapse>
            </div>
        </div>
        <div id="commentsModal" class="modal" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">{{ 'Viewing comments for "' + $data.selectedField + '"' }}</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <table class="table">
                            <thead>
                            <tr>
                                <th scope="col">Timestamp</th>
                                <th scope="col">Username</th>
                                <th scope="col">Comment</th>
                            </tr>
                            </thead>
                            <tbody class="comment-table">
                                <tr v-for="(data, index) in lastRequestData">
                                    <td>{{ data['ts'] }}</td>
                                    <td>{{ data['username'] }}</td>
                                    <td v-if="index === lastRequestData.length - 1" class="comment-cell">
                                        <textarea id="userComment" style="width: 100%"></textarea>
                                    </td>
                                    <td v-else class="comment-cell">{{ data['comment'] }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button type="button" id="submit-comment" class="btn btn-primary" data-dismiss="modal">Comment</button>
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
        <div id="historyModal" class="modal" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">{{ 'Viewing history for "' + $data.selectedField + '"' }}</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <table class="table">
                            <thead>
                            <tr>
                                <th scope="col">Timestamp</th>
                                <th scope="col">Username</th>
                                <th scope="col">Data Changes Made</th>
                            </tr>
                            </thead>
                            <tbody>
                            <tr v-for="data in lastRequestData">
                                <td>{{ data['ts'] }}</td>
                                <td>{{ data['user'] }}</td>
                                <td>{{ data['value'] }}</td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
        <div id="surveyModal" class="modal" tabindex="-1" role="dialog">
            <div class="modal-dialog modal-lg" role="document" style="height: 80%">
                <div class="modal-content" style="height: 100%">
                    <div class="modal-body">
                        <iframe name="surveyIframe" src="" width="100%" height="99%"></iframe>
                    </div>
                    <div class="modal-footer">
                        <div class="btn-group mr-auto">
                            <button type="button" class="btn btn-danger dropdown-toggle form-status" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                Incomplete
                            </button>
                            <div class="dropdown-menu">
                                <a class="dropdown-item change-status" href="#" data-id="0" data-status="Incomplete" data-class="btn-danger">Mark form as Incomplete</a>
                                <a class="dropdown-item change-status" href="#" data-id="1" data-status="Unverified" data-class="btn-warning">Mark form as Unverified</a>
                                <a class="dropdown-item change-status" href="#" data-id="2" data-status="Complete" data-class="btn-success">Mark form as Complete</a>
                            </div>
                        </div>
                        <button type="button" class="btn btn-danger cancel-button">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>