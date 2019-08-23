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
            'incomplete': complete == 0,
            'unverified': complete == 1,
            'complete': complete == 2
        }"
        data-toggle="collapse"
        style="display: table"
    >
        <h5 class="mb-0" style="float: left;">
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
                        'badge-light': getOverallStatus(name) == null,
                        'badge-danger': getOverallStatus(name) == 0,
                        'badge-warning': getOverallStatus(name) == 1,
                        'badge-success': getOverallStatus(name) == 2,
                        'badge-primary': getOverallStatus(name) == 3
                    }"
                >
                    {{ getRepeatInstanceCount(name) }}
                </span>
            </span>
        </h5>
<!--            <div class="no-collapse">-->
<!--                <button class="btn btn-primary save-button" style="float: right">-->
<!--                    <i class="fas fa-save"></i>-->
<!--                </button>-->
<!--            </div>-->
    </div>
</script>

<script type="text/x-template" id="cardCollapse">
    <div :id="'collapse_' + name + (index ? repeatSuffix(index) : '')" class="collapse" :aria-labelledby="'heading_' + name" :data-parent="'#accordion' + (index ? '_' + name : '')">
        <div class="card-body">
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
                            <button class="btn btn-primary edit-button" :data-edit="field + repeatSuffix(index)" v-if="getFormRights(name) != 2">
                                <i class="fas fa-edit fa-fw"></i>
                            </button>
                            <button v-if="dictionary[field]['field_type'] == 'dropdown'" class="btn btn-secondary copy-button" :data-clipboard-text="choiceToLabel(record[field], field)">
                                <i class="far fa-clipboard fa-fw"></i>
                            </button>
                            <button v-else class="btn btn-secondary copy-button" :data-clipboard-target="'#' + 'edit-' + field + repeatSuffix(index)">
                                <i class="far fa-clipboard fa-fw"></i>
                            </button>
                            <button v-if="dictionary[field]['field_note'] !== ''" class="btn btn-info" :data-edit="field + repeatSuffix(index)" data-toggle="popover" data-container="body" :data-content="dictionary[field]['field_note']" data-placement="top">
                                <i class="fas fa-question fa-fw"></i>
                            </button>
                        </div>
                        <div v-if="dictionary[field]['field_type'] == 'text'" class="field-content">
                            <input
                                    :id="'edit-' + field + repeatSuffix(index)"
                                    :data-name="field + repeatSuffix(index)"
                                    v-model="record[field]"
                                    class="form-control"
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
                                <form method="post" enctype="multipart/form-data">
                                    <input type="file" name="file" multiple />
                                    <input type="submit" value="Upload File" name="submit" />
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</script>
<h5 id="saveStatus">
    <div id="saveMsg" class="badge badge-success">
        <i class="fas fa-check"></i> All changes saved
    </div>
</h5>
<div id="app">
    <div v-cloak>
        <h2 style="text-align: center; color: #106CD6; font-weight: bold; padding-bottom: 20px">
            {{ projectTitle }}
        </h2>

        <div style="text-align: center">
            <label for="recordSelect">Viewing Record</label>
            <select v-if="Object.keys(redcapData).length > 1" id="recordSelect" class="form-control" v-model="selectedRecordId">
                <option v-for="(recordData, recordId) in redcapData" :value="recordId">
                    {{ recordId + ' - ' + choiceToLabel(redcapData[recordId][eventId][recordLabel], recordLabel) }}
                </option>
            </select>
            <span v-else>
                {{ selectedRecordId + ' - ' + choiceToLabel(redcapData[selectedRecordId][eventId][recordLabel], recordLabel) }}
            </span>
        </div>
        <br/>
        <br/>
        <div id="accordion">
            <div class="card" v-for="(formLabel, formName, index) in instruments" v-if="getFormRights(formName) != 0">
                <card-header
                    :name="formName"
                    :label="formLabel"
                    :complete="redcapData[selectedRecordId][eventId][formName + '_complete']"
                ></card-header>
                <div
                    v-if="isRepeatingForm(formName)"
                    :id="'collapse_' + formName"
                    class="collapse"
                    :aria-labelledby="'heading_' + formName"
                    data-parent="#accordion"
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
                                    :label="repeatingForms[formName]"
                                    :complete="recordData[formName + '_complete']"
                                ></card-header>
                                <card-collapse
                                    :record="recordData"
                                    :index="repeatIndex"
                                    :name="formName"
                                    :label="formLabel"
                                    :fields="fields[formName]"
                                    :dictionary="dataDictionary"
                                ></card-collapse>
                            </div>
                            <div style="float: right; margin: 20px;">
                                <button class="btn btn-primary add-repeat-instance" :data-add="formName">
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
                    :fields="fields[formName]"
                    :dictionary="dataDictionary"
                ></card-collapse>
            </div>
        </div>
    </div>
</div>