var app;

window.closeModal = function(){
    if (UIOWA_EasyEdit.surveyOpen) {
        // $('#surveyModal').find('iframe').attr('src', '');
        $('#surveyModal').modal('hide');
        UIOWA_EasyEdit.surveyOpen = false;
    }
};

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
                            // pipedValue = self.choiceToLabel(pipedValue, pipedField);
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
            }
        }
    };

    Vue.component('card-header', {
        props: [
            'index',
            'name',
            'label',
            'record',
            'complete',
            'survey',
            'modifycompleted'
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
            // UIOWA_EasyEdit.refreshEditButtons();
            //
            // if (UIOWA_EasyEdit.lastAddedInstance) {
            //     var dataEdit = UIOWA_EasyEdit.lastAddedInstance['form'] + '__' + UIOWA_EasyEdit.lastAddedInstance['index'];
            //
            //     $('#collapse_' + dataEdit).collapse('show');
            //
            //     UIOWA_EasyEdit.toggleEdit(UIOWA_EasyEdit.lastAddedInstance);
            // }
        },
        watch: {
            redcapData: {
                deep: true,
                handler() {
                    // $('#saveMsg')
                    //     .removeClass(function (index, className) {
                    //         return (className.match (/(^|\s)badge-\S+/g) || []).join(' ');
                    //     })
                    //     .addClass('badge-primary')
                    //     .html('<i class="fas fa-exclamation-circle"></i> Unsaved changes');
                    //
                    // UIOWA_EasyEdit.promptBeforeDiscarding = true;
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

    // todo need survey settings for reference
    // if no save and return + complete, show checkmark


    // get comment counts to display on buttons
    $.each(UIOWA_EasyEdit.commentCounts, function (key, count) {
        var $commentButton = $('.show-comments[data-edit=' + key + ']');

        if ($commentButton.length === 0) {
            $commentButton = $('.show-comments[data-edit=' + key + '__1]');
        }

        $commentButton.find('.comment-count').html(count);
    });

    $('.edit-button').each(function () {
        var form = $(this).data('edit');

        // disable if no survey
        if (UIOWA_EasyEdit.formMetadata[form]['survey'] === null) {
            // $(this).prop('disabled', 'disabled');
            $(this).remove();
        }
    });

    $('.edit-button').click(function (e) {
        e.stopPropagation();

        // disable edit buttons and add instance buttons
        $('.edit-button').prop('disabled', 'disabled');

        // show loading icon while survey loads
        $(this)
            .find('i')
            .removeClass('fa-edit')
            .addClass('fa-spinner fa-spin');

        var form = $(this).data('edit');
        var repeatIndex = $(this).data('repeat-index');

        var surveyLink = UIOWA_EasyEdit.formMetadata[form]['survey'];

        if ($(this).hasClass('add-new-instance') && typeof surveyLink === 'object') {
            surveyLink = surveyLink['new'];
        }
        if (repeatIndex) {
            surveyLink = surveyLink[repeatIndex];
        }

        UIOWA_EasyEdit.surveyOpen = false;

        // open survey in modal
        var surveyIframe = $('#surveyModal').find('iframe');

        // send username to survey so changes are logged properly
        $('body').append('<form action="'+surveyLink+'" method="post" target="surveyIframe" id="postToIframe"></form>');
        $('#postToIframe')
            .append('<input type="hidden" name="username" value="'+UIOWA_EasyEdit.loggedInUser+'" />')
            .submit()
            .remove();

        surveyIframe.on('load', () => {
            // remove loading icon
            $(this)
                .find('i')
                .removeClass('fa-spinner fa-spin')
                .addClass('fa-edit');

            if (!UIOWA_EasyEdit.surveyOpen) {
                $('#surveyModal').modal({backdrop: 'static', keyboard: false});

                // store form and index on status button for later
                UIOWA_EasyEdit.surveyOpen = {
                    'form': form,
                    'index': repeatIndex
                };
            }
        });

        // open survey
        // window.location.href = surveyLink + '&edit=' + UIOWA_EasyEdit.selectedRecordId;
    });

    $('.cancel-button').click(function () {
        var closeSurvey = function () {
            // enable edit buttons and add instance buttons until saved
            $('.edit-button').prop('disabled', '');

            $('#surveyModal').modal('hide');
        };

        if (UIOWA_EasyEdit.newAlertsSupported) {
            Swal.fire({
                title: 'Cancel Editing?',
                text: "Changes will NOT be saved.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Discard Changes',
                cancelButtonText: 'Keep Editing'
            }).then((result) => {
                if (result.value) {
                    closeSurvey();
                }
            })
        }
        else {
            var confirmed = confirm('Are you sure you want to cancel editing? Changes will NOT be saved.');

            if (confirmed) {
                closeSurvey();
            }
        }

        // UIOWA_EasyEdit.toggleEdit($(this).data('edit'), false);
    });

    $('.show-comments').click(function () {
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

                // todo still need this?
                // $.each(UIOWA_EasyEdit.lastRequestData, function () {
                //
                //     // this.comment = $.text(this.comment);
                // });

                var count = UIOWA_EasyEdit.lastRequestData.length - 1;

                if (count > UIOWA_EasyEdit.commentCounts[UIOWA_EasyEdit.selectedField]) {
                    UIOWA_EasyEdit.commentCounts[UIOWA_EasyEdit.selectedField] = count;

                    $('.show-comments[data-edit=' + UIOWA_EasyEdit.selectedField + ']')
                        .find('.comment-count')
                        .html(count);
                }

                app.$forceUpdate();

                $('#commentsModal').modal('show');
            })
    });

    $('.download-button').click(function () {
        var fileLink = $(this).data('link');

        if (fileLink) {
            window.location.href = fileLink;
        }
        else {
            var fieldName = $(this).data('edit');
            var $fieldContent = $('#edit-' + fieldName);

            UIOWA_EasyEdit.generateWordDoc($fieldContent.val(), fieldName);
        }

    });

    $('.history-button').click(function () {
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
            .done(function (result) {
                UIOWA_EasyEdit.lastRequestData = JSON.parse(result);

                app.$forceUpdate();
                $('#historyModal').modal('show');
            })
    });

    // todo save this
    $('.change-status').click(function () {
        var $formStatus = $('.form-status');
        var statusId = $(this).data('id');

        $formStatus
            .removeClass (function (index, className) {
                return (className.match (/(^|\s)btn-\S+/g) || []).join(' ');
            })
            .addClass($(this).data('class'))
            .html($(this).data('status'));

        UIOWA_EasyEdit.redcapData
            [UIOWA_EasyEdit.selectedRecordId]
            [UIOWA_EasyEdit.eventId]
            [UIOWA_EasyEdit.surveyOpen['form'] + '_complete'] = statusId.toString();
    });

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

    app.getProgressPercentage();
});

var UIOWA_EasyEdit = {
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