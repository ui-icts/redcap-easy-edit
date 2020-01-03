var app;

$(document).ready(function() {
    var mixin = {
        methods: {
            choiceToLabel: function (value, field) {
                var data = this.$root.$data;
                var fieldInfo = data.dataDictionary[field];

                if (!fieldInfo) {
                    value = '';
                }
                else if (fieldInfo['select_choices_or_calculations']) {
                    value = fieldInfo['select_choices_or_calculations'][value];
                }

                return value;
            },
            formatText: function (text, recordData) {
                // todo find way to use built-in method
                // maybe like....use built-in on render for smart vars and mine for reactive
                // $.ajax({
                //     url: UIOWA_EasyEdit.requestUrl,
                //     type: 'POST',
                //     data: {
                //         type: 'piping',
                //         record: this.$root.$data.selectedRecordId,
                //         label: text
                //     },
                //     success: function(result) {
                //         console.log(result);
                //
                //         return result;
                //     }
                // });

                var self = this;
                var pipedVariables = text.match(/\[(.*?)\]/g);

                if (pipedVariables) {
                    $.each(pipedVariables, function (index, value) {
                        var pipedField = value.replace('[', '').replace(']', '');
                        var pipedFieldInfo = self.$root.$data.dataDictionary[pipedField];
                        var pipedValue = recordData[pipedField];

                        if (pipedValue === '' || pipedValue === undefined) {
                            pipedValue = '______';
                        }
                        else if (pipedFieldInfo['field_type'] === 'checkbox') {
                            var pipedList = [];

                            $.each(pipedValue, function (choice, value) {
                                if (value === '1') {
                                    pipedList.push(self.choiceToLabel(choice, pipedField))
                                }
                            });

                            pipedValue = pipedList.join(', ')
                        }
                        else {
                            pipedValue = self.choiceToLabel(pipedValue, pipedField);
                        }

                        text = text.replace(value, pipedValue);
                    })
                }

                return text;
            },
            repeatSuffix: function (index) {
                var suffix = '';

                if (index) {
                    suffix = '__' + index;
                }

                return suffix;
            },
            getFormRights: function (formName) {
                var data = this.$root.$data;

                return data.formRights[formName];
            },
            isRepeatingForm: function (formName) {
                var data = this.$root.$data;
                var repeatingForms = data.repeatingForms;

                return Object.keys(repeatingForms).includes(formName);
            },
            getRepeatInstanceCount: function (formName) {
                var data = this.$root.$data;
                var repeatInstances = data.redcapData[data.selectedRecordId]['repeat_instances'][data.eventId];
                var count = 0;

                if (repeatInstances[formName]) {
                    count = Object.keys(repeatInstances[formName]).length;
                }

                return count;
            },
            getOverallStatus: function (formName) {
                var data = this.$root.$data.redcapData[UIOWA_EasyEdit.selectedRecordId];
                var repeatInstances =
                    'repeat_instances' in data ?
                    data['repeat_instances'][UIOWA_EasyEdit.eventId] :
                    {};
                var overallStatus = null;

                if (repeatInstances) {
                    if (formName in repeatInstances) {
                        var allStatuses = $.map(repeatInstances[formName], function (instance) {
                            var statusField = formName + '_complete';

                            return instance[statusField];
                        });

                        if (allStatuses.length > 0) {
                            if (allStatuses.every(function (status) {return status === '2';})) {
                                overallStatus = '2';
                            }
                            else if (allStatuses.every(function (status) {return status === '1';})) {
                                overallStatus = '1';
                            }
                            else if (allStatuses.every(function (status) {return status === '0';})) {
                                overallStatus = '0';
                            }
                            else {
                                overallStatus = '3';
                            }
                        }
                    }
                    else {
                        var formData = data[UIOWA_EasyEdit.eventId];
                        var statusField = formName + '_complete';

                        overallStatus = formData[statusField];
                    }
                }

                return overallStatus;
            },
            addRepeatInstance: function (form) {
                var data = this.$data;
                var repeatInstances = data.redcapData[data.selectedRecordId]['repeat_instances'][data.eventId][form];

                if (!repeatInstances) {
                    repeatInstances = {};
                }

                var newInstanceIndex = Math.max(...Object.keys(repeatInstances)) + 1;
                var newInstance = {};

                // todo must not copy non-data fields
                $.each(data.dataDictionary, function (index, field) {

                    if (field['field_name'] !== undefined && field['field_type'] !== undefined) {
                        if (field['field_type'] === 'checkbox') {
                            var choiceKeys = Object.keys(field['select_choices_or_calculations']);
                            newInstance[field['field_name']] = {};

                            $.each(choiceKeys, function (index, value) {
                                newInstance[field['field_name']][value] = '0';
                            })
                        }
                        else if (field['field_type'] !== 'descriptive') {
                            newInstance[field['field_name']] = '';
                        }
                    }
                });

                newInstance[form + '_complete'] = '0';

                if (newInstanceIndex === 1) {
                    Vue.set(data.redcapData[data.selectedRecordId]['repeat_instances'][data.eventId], form, {
                        1: newInstance
                    });
                }
                else {
                    Vue.set(repeatInstances, newInstanceIndex, newInstance);
                }

                this.$forceUpdate();

                UIOWA_EasyEdit.lastAddedInstance = form + '__' + newInstanceIndex;
            },
            getProgressPercentage: function (type) {
                var regex = new RegExp('_complete$');
                var data = this.$data.redcapData[UIOWA_EasyEdit.selectedRecordId];
                var statuses = {
                    'incomplete': 0,
                    'unverified': 0,
                    'complete': 0,
                    'total': 0
                };
                var keys = Object
                    .keys(data[UIOWA_EasyEdit.eventId])
                    .filter(function(key) { return key.match(regex) });

                $.each(keys, function(index, key) {
                    var status = data[UIOWA_EasyEdit.eventId][key];

                    if (status === '') {
                        var formName = key.replace(regex, '');
                        var instances = data.repeat_instances[UIOWA_EasyEdit.eventId][formName];

                        $.each(instances, function (index, instance) {
                            countStatus(instance[key]);
                        });
                    }
                    else {
                        countStatus(status);
                    }
                });

                return statuses[type] / statuses['total'] * 100 + '%';

                function countStatus (status) {
                    if (status === '0') {
                        status = 'incomplete';
                    }
                    else if (status === '1') {
                        status = 'unverified';
                    }
                    else if (status === '2') {
                        status = 'complete';
                    }

                    statuses[status] += 1;
                    statuses['total'] += 1;
                }
            },
            getFieldComments: function (field) {
                if (!field) {
                    field = UIOWA_EasyEdit.selectedField;
                }
                var comments = UIOWA_EasyEdit.fieldComments;

                if (field in comments) {
                    return UIOWA_EasyEdit.fieldComments[field]
                }
                else {
                    return {};
                }
            },
            getFieldHistory: function (field) {
                if (!field) {
                    field = UIOWA_EasyEdit.selectedField;
                }


            },
            getSelectedField: function () {
                if (UIOWA_EasyEdit.selectedField) {
                    return UIOWA_EasyEdit.dataDictionary[UIOWA_EasyEdit.selectedField]['field_label'];
                }
                else {
                    return "No field selected";
                }
            }
        }
    };

    Vue.component('card-header', {
        props: [
            'index',
            'name',
            'label',
            'record',
            'complete'
        ],
        template: '#cardHeader',
        mixins: [mixin]
    });

    Vue.component('card-collapse', {
        props: [
            'index',
            'name',
            'label',
            'record',
            'fields',
            'dictionary',
            'config'
        ],
        template: '#cardCollapse',
        mixins: [mixin]
        // ,
        // watch: {
        //     record: {
        //         deep: true,
        //         handler() {
        //             var rootData = this.$root.$data;
        //             var componentData = this.$data;
        //
        //             this
        //                 .$root
        //                 .$data
        //                 .redcapData
        //                 [rootData.selectedRecordId]
        //                 ['repeat_instances']
        //                 [rootData.eventId]
        //                 [componentData.name]
        //                 [componentData.index] = componentData.record;
        //         }
        //     }
        // }
    });

    // todo need to access this later
    app = new Vue({
        el: '#app',
        data: UIOWA_EasyEdit,
        mixins: [mixin],
        updated: function() {
            UIOWA_EasyEdit.refreshEditButtons();

            if (UIOWA_EasyEdit.lastAddedInstance) {
                $('#collapse_' + UIOWA_EasyEdit.lastAddedInstance).collapse('show');

                UIOWA_EasyEdit.toggleEdit(UIOWA_EasyEdit.lastAddedInstance);

                delete UIOWA_EasyEdit.lastAddedInstance;
            }
        },
        watch: {
            redcapData: {
                deep: true,
                handler() {
                    $('#saveMsg')
                        .removeClass(function (index, className) {
                            return (className.match (/(^|\s)badge-\S+/g) || []).join(' ');
                        })
                        .addClass('badge-primary')
                        .html('<i class="fas fa-exclamation-circle"></i> Unsaved changes');

                    UIOWA_EasyEdit.promptBeforeDiscarding = true;
                }
            }
        }
    });

    // $('#recordSelect').change(function () {
    //     var href = new URL(window.location);
    //     href.searchParams.set('record_id', $(this).val());
    //     window.location.href = href;
    // });

    // Update edit button to copy selected dropdown text (not needed?)
    // $(document).on('change', 'select', function () {
    //     var select = $(this);
    //     var field = select.attr('data-name');
    //     var editButton = $("button[data-clipboard-target='#edit-" + field + "']");
    //
    //     editButton.attr('data-clipboard-text', $('option:selected', select).text());
    // });

    // initial update of edit buttons for radio/checkboxes
    $('.field-content').each(function (index, element) {
        var input = $(element).find('input').first();

        if (input.attr('type') === 'checkbox' || input.attr('type') === 'radio') {
            UIOWA_EasyEdit.updateClipboardButton(input);
        }
    });

    // update edit button to copy selected checkbox text
    $(':checkbox').on('click', function () {
        UIOWA_EasyEdit.updateClipboardButton($(this));
    });

    // update edit button to copy selected radio text
    $('input[type=radio]').change(function () {
        UIOWA_EasyEdit.updateClipboardButton($(this));
    });

    $('.add-repeat-instance').click(function () {
        var form = $(this).attr('data-add');

        app.addRepeatInstance(form);
    });

    var copyButtonClass = '.copy-button';

    $(copyButtonClass).popover({
        trigger: 'click',
        placement: 'bottom'
    });

    var clipboard = new ClipboardJS(copyButtonClass);

    //todo fix clipboard messages
    // clipboard.on('success', function(e) {
    //     setTooltip('Copied!');
    //     hideTooltip();
    // });
    // clipboard.on('error', function(e) {
    //     setTooltip('Failed!');
    //     hideTooltip();
    // });

    // $('.collapse').on('show.bs.collapse', function(e) {
    //     var $card = $(this).closest('.card');
    //     var $open = $($(this).data('parent')).find('.collapse.show');
    //
    //     var additionalOffset = 0;
    //     if($card.prevAll().filter($open.closest('.card')).length !== 0)
    //     {
    //         additionalOffset =  $open.height();
    //     }
    //     $('html,body').animate({
    //         scrollTop: $card.offset().top - additionalOffset
    //     }, 500);
    // });

    $('#submit-comment').click(function () {
        var instance = $(this).data('instance') || 1;

        $.ajax({
            method: 'POST',
            url: UIOWA_EasyEdit.requestUrl + '&type=submitComment',
            data: {
                record: UIOWA_EasyEdit.selectedRecordId,
                field: UIOWA_EasyEdit.selectedField.split('__')[0],
                event_id: UIOWA_EasyEdit.eventId,
                instance: instance,
                comment: $('#userComment').val()
            }
        })

        //todo

        // $.ajax({
        //     method: 'POST',
        //     url: UIOWA_EasyEdit.requestUrl + '&type=getComments',
        //     data: {
        //         pid: UIOWA_EasyEdit.projectId,
        //         record_id: UIOWA_EasyEdit.selectedRecordId,
        //         field: UIOWA_EasyEdit.selectedField.split('__')[0],
        //         instance: instance,
        //     }
        // })
        //     .done(function(result) {
        //         UIOWA_EasyEdit.lastRequestData = JSON.parse(result);
        //         console.log(UIOWA_EasyEdit.lastRequestData);
        //
        //         if (UIOWA_EasyEdit.lastRequestData.length > UIOWA_EasyEdit.commentCounts[UIOWA_EasyEdit.selectedField]) {
        //             UIOWA_EasyEdit.commentCounts[UIOWA_EasyEdit.selectedField] = UIOWA_EasyEdit.lastRequestData.length;
        //         }
        //
        //         app.$forceUpdate();
        //
        //         $('#commentTimestamp').html(Date.now());
        //         $('#commentUsername').html(UIOWA_EasyEdit.loggedInUser);
        //
        //         $('#commentsModal').modal('show');
        //     })
    });

    $('#collapseAll').click(function() {
        $('.collapse').collapse('hide');
    });

    $('#expandAll').click(function() {
        UIOWA_EasyEdit.expandAll = true;

        $('.collapse').collapse('show');

        UIOWA_EasyEdit.expandAll = false;
    });

    $('[data-toggle="popover"]').popover();

    $('#accordion').on('shown.bs.collapse', function (e) {
        UIOWA_EasyEdit.saveAccordionState(e, 'show');
    });

    $('#accordion').on('hidden.bs.collapse', function (e) {
        UIOWA_EasyEdit.saveAccordionState(e, 'hide');

        // todo handling for last repeat instance
        if (UIOWA_EasyEdit.lastDataEdit) {
            $('#collapse_' + UIOWA_EasyEdit.lastDataEdit).parent().next().find('.collapse').collapse('show');

            UIOWA_EasyEdit.lastDataEdit = false;
        }
    });

    // scroll to top of accordion on open
    $('.collapse').on('show.bs.collapse', function(e) {
        if (!UIOWA_EasyEdit.expandAll) {
            var $card = $(this).closest('.card');
            var $open = $($(this).data('parent')).find('.collapse.show');

            var additionalOffset = 0;
            if($card.prevAll().filter($open.closest('.card')).length !== 0)
            {
                additionalOffset =  $open.height();
            }
            $('html,body').animate({
                scrollTop: $card.offset().top - additionalOffset
            }, 500);
        }
    });

    $(document).on('click', '.file-upload', function (e) {
        filePopUp($(e.target).data('field'), 0, 1)
    });

    UIOWA_EasyEdit.restoreAccordionState();
    UIOWA_EasyEdit.refreshEditButtons();

    app.getProgressPercentage();
});

var UIOWA_EasyEdit = {
    refreshEditButtons: function() {
        // Remove handler from existing elements
        $('.edit-button').off();
        $('.cancel-button').off();
        $('.show-comments').off();
        $('.download-button').off();
        $('.history-button').off();

        $.each(UIOWA_EasyEdit.commentCounts, function (key, count) {
            var $commentButton = $('.comment-button[data-edit=' + key + ']');

            if ($commentButton.length === 0) {
                $commentButton = $('.comment-button[data-edit=' + key + '__1]');
            }

            $commentButton.find('.comment-count').html(count);
        });

        // Re-add event handler for all matching elements
        $('.edit-button').on('click', function (e) {
            e.stopPropagation();

            UIOWA_EasyEdit.toggleEdit($(this).data('edit'), true, $(this).hasClass('edit-collapse'));
        });

        $('.cancel-button').on('click', function (e) {
            e.stopPropagation();

            if (UIOWA_EasyEdit.promptBeforeDiscarding) {
                confirm('You have unsaved changes on this form! Are you sure you want to cancel editing and revert?')
            }
            UIOWA_EasyEdit.toggleEdit($(this).data('edit'), false);
        });

        $('.show-comments').on('click', function (e) {
            UIOWA_EasyEdit.selectedField = $(this).data('edit');

            var instance = $(this).data('instance') || 1;

            $.ajax({
                method: 'POST',
                url: UIOWA_EasyEdit.requestUrl + '&type=getComments',
                data: {
                    pid: UIOWA_EasyEdit.projectId,
                    record_id: UIOWA_EasyEdit.selectedRecordId,
                    field: UIOWA_EasyEdit.selectedField.split('__')[0],
                    instance: instance,
                }
            })
                .done(function(result) {
                    UIOWA_EasyEdit.lastRequestData = JSON.parse(result);

                    $.each(UIOWA_EasyEdit.lastRequestData, function () {

                        this.comment = $.text(this.comment);
                    });

                    if (UIOWA_EasyEdit.lastRequestData.length > UIOWA_EasyEdit.commentCounts[UIOWA_EasyEdit.selectedField]) {
                        UIOWA_EasyEdit.commentCounts[UIOWA_EasyEdit.selectedField] = UIOWA_EasyEdit.lastRequestData.length;
                    }

                    app.$forceUpdate();

                    $('#commentsModal').modal('show');
                })
        });

        $('.download-button').on('click', function (e) {
            var fieldName = $(this).data('edit');
            var $fieldContent = $('#edit-' + fieldName);

            UIOWA_EasyEdit.generateWordDoc($fieldContent.val(), fieldName);
        });

        $('.history-button').on('click', function (e) {
            UIOWA_EasyEdit.selectedField = $(this).data('edit');

            var instance = $(this).data('instance');

            $.ajax({
                method: 'POST',
                url: UIOWA_EasyEdit.requestUrl + '&type=getDataHistory',
                data: {
                    record_id: UIOWA_EasyEdit.selectedRecordId,
                    event_id: UIOWA_EasyEdit.eventId,
                    field: UIOWA_EasyEdit.selectedField.split('__')[0],
                    instance: instance
                }
            })
            .done(function(result) {
                UIOWA_EasyEdit.lastRequestData = JSON.parse(result);

                app.$forceUpdate();
                $('#historyModal').modal('show');
            })
        })
    },
    updateClipboardButton: function (fieldInput) {
        var field = fieldInput.attr('data-name');
        var editButton = $("button[data-clipboard-target='#edit-" + field + "']");

        if (fieldInput.attr('type') === 'checkbox') {
            var fieldCheckboxes = $('#edit-' + field).find('input');
            var selectedChoices = [];

            fieldCheckboxes.each(function (index, element) {
                var $element = $(element);
                var label = $("label[for='" + $(element).attr('id') + "']").html();

                if ($element.is(':checked')) {
                    selectedChoices.push(label.trim());
                }
            });

            editButton.attr('data-clipboard-text', selectedChoices.join(', '));
        }
        else if (fieldInput.attr('type') === 'radio') {
            var label = $("label[for='" + fieldInput.attr('id') + "']").html();

            editButton.attr('data-clipboard-text', label);
        }
    },
    generateWordDoc: function (content, field) {
        const doc = new Document();

        doc.Styles.createParagraphStyle('default', 'Default')
            .font("Arial")
            .size(22);

        const paragraph = new Paragraph(content).style('default');

        doc.addParagraph(paragraph);

        const packer = new Packer();

        packer.toBlob(doc).then(blob => {
            saveAs(blob, field + ".docx");
        });
    },
    toggleEdit: function (dataEdit, saveData, expandNext) {
        var dataEditSelector = '[data-edit="' + dataEdit + '"]';
        var $editButtons = $('.edit-button' + dataEditSelector);
        var $cancelButtons = $('.cancel-button' + dataEditSelector);
        var $otherEditButtons = $('.edit-button').not(dataEditSelector);
        var $formContent = $('.redcap-form-content' + dataEditSelector);
        var $editFields = $formContent.find('.field-content');

        $($editFields).each(function(index, field) {
            var $field = $(field).find(':first-child');
            var prop = 'readonly';
            var locked = $field.hasClass('locked');

            if ($field.is('div')) {
                prop = 'disabled';
                $field = $field.find('input');
            }
            else if ($field.is('select')) {
                prop = 'disabled';
            }

            if (!locked) {
                $field.prop(prop, !$field.prop(prop));
            }
        });

        var $secondaryEditButton = $('.edit-button' + dataEditSelector +'.edit-collapse > span');

        if ($editButtons.find('i').hasClass('fa-edit')) {
            // show cancel buttons
            $cancelButtons.show();

            this.promptBeforeDiscarding = false;

            $editButtons
                .removeClass('btn-primary')
                .addClass('btn-success')
                .find('i')
                .removeClass('fa-edit')
                .addClass('fa-check');

            var $collapse = $('#collapse_' + dataEdit);

            if (!$collapse.hasClass('show')) {
                $collapse.collapse('show');
            }

            // disable other edit and add instance buttons until saved
            $otherEditButtons.prop('disabled', 'disabled');
            $('.add-repeat-instance').prop('disabled', 'disabled');

            // update text on secondary save button
            $secondaryEditButton.html(' Save & Edit Next Form');

            this.redcapDataCache = $.extend(true, {}, this.redcapData);
        }
        else {
            if (saveData) {
                $editButtons
                    .prop('disabled', 'disabled')
                    .find('i')
                    .removeClass('fa-edit')
                    .addClass('fa-spinner fa-spin');

                this.saveRedcapData(this.redcapData, $editButtons, dataEdit, expandNext);
            } else {
                var recordData = this.redcapData[this.selectedRecordId];
                var recordDataCache = this.redcapDataCache[this.selectedRecordId];

                if (dataEdit.includes('__')) {
                    var formName = dataEdit.split('__')[0];
                    var instanceId = dataEdit.split('__')[1];

                    recordData = recordData['repeat_instances'][this.eventId][formName][instanceId];
                    recordDataCache = recordDataCache['repeat_instances'][this.eventId][formName][instanceId];
                }
                else {
                    recordData = recordData[this.eventId];
                    recordDataCache = recordDataCache[this.eventId];
                }

                $('div[data-edit="' + dataEdit + '"]')
                    .find('[data-name]')
                    .each(function(index, field) {
                        var fieldName = $(field).data('name').split('__')[0];

                        if (!(recordData[fieldName] === recordDataCache[fieldName])) {
                            recordData[fieldName] = recordDataCache[fieldName];
                        }
                    });

                this.resetEditButtons(dataEdit);

                this.redcapDataCache = {};

                $('#saveMsg')
                    .removeClass(function (index, className) {
                        return (className.match (/(^|\s)badge-\S+/g) || []).join(' ');
                    })
                    .addClass('badge-success')
                    .html('<i class="fas fa-check"></i> All changes saved');
            }
        }
    },
    saveRedcapData: function (data, $editButtons, dataEdit, expandNext) {
        var saveMsg = $('#saveMsg');

        saveMsg
            .removeClass(function (index, className) {
                return (className.match (/(^|\s)badge-\S+/g) || []).join(' ');
            })
            .addClass('badge-primary')
            .html('<i class="fas fa-spinner fa-spin"></i> Saving...');

        $.ajax({
            url: UIOWA_EasyEdit.requestUrl + '&type=save',
            type: 'POST',
            data: JSON.stringify(data),
            success: function(result) {
                console.log(result);

                result = JSON.parse(result);

                if (result.errors.length > 0) {
                    var errors = [];
                    $.each(result.errors, function (index, item) {
                        item = item.replace(/['"]+/g, '').split(',');

                        $('#' + item[2]) //todo?
                    });

                    console.log(errors);

                    saveMsg
                        .removeClass(function (index, className) {
                            return (className.match (/(^|\s)badge-\S+/g) || []).join(' ');
                        })
                        .addClass('badge-danger')
                        .html('<i class="fas fa-times"></i> Failed to save changes!');
                }
                else {
                    saveMsg
                        .removeClass(function (index, className) {
                            return (className.match (/(^|\s)badge-\S+/g) || []).join(' ');
                        })
                        .addClass('badge-success')
                        .html('<i class="fas fa-check"></i> All changes saved');
                }

                // enable all buttons after save
                UIOWA_EasyEdit.resetEditButtons(dataEdit);

                $('#collapse_' + dataEdit).collapse('hide');

                if (expandNext) {
                    UIOWA_EasyEdit.lastDataEdit = dataEdit;
                }
            }
        })
    },
    resetEditButtons: function (dataEdit) {
        // hide cancel buttons
        $('.cancel-button[data-edit="' + dataEdit + '"]').hide();

        // enable all buttons after save
        $('.edit-button').prop('disabled', '');
        $('.add-repeat-instance').prop('disabled', '');
        $('.edit-button[data-edit="' + dataEdit + '"]')
            .addClass('btn-primary')
            .removeClass('btn-success')
            .find('i')
            .addClass('fa-edit')
            .removeClass('fa-spinner fa-spin');

        // update text on secondary save button
        $('.edit-button.edit-collapse[data-edit="' + dataEdit + '"] > span').html(' Edit');
    },
    restoreAccordionState: function () {
        UIOWA_EasyEdit.visibleAccordions = JSON.parse(localStorage.getItem('visibleAccordions')) || [];

        $.each(UIOWA_EasyEdit.visibleAccordions, function(index, accordionId) {
            $("#" + accordionId).addClass("show");
        })
    },
    saveAccordionState: function (e, state) {
        var id = e.target.id;
        var idIndex = UIOWA_EasyEdit.visibleAccordions.indexOf(id);

        if (state === 'show' && idIndex === -1) {
            UIOWA_EasyEdit.visibleAccordions.push(id);
        }
        else if (state === 'hide' && idIndex !== -1) {
            UIOWA_EasyEdit.visibleAccordions.splice(idIndex, 1);
        }

        localStorage.setItem('visibleAccordions', JSON.stringify(UIOWA_EasyEdit.visibleAccordions));
    }
};

// function setTooltip(message) {
//     $(copyButtonClass).tooltip('hide')
//         .attr('data-original-title', message)
//         .tooltip('show');
// }
//
// function hideTooltip() {
//     setTimeout(function() {
//         $(copyButtonClass).tooltip('hide');
//     }, 1000);
// }

// :class="{show:(index == 2)}"