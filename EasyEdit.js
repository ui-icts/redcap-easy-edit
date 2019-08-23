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

                        if (pipedFieldInfo['field_type'] === 'checkbox') {
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

                        if (pipedValue === '' || pipedValue === undefined) {
                            pipedValue = '______';
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
                var data = this.$root.$data;
                var repeatInstances = data.redcapData[data.selectedRecordId]['repeat_instances'][data.eventId];
                var allStatuses = $.map(repeatInstances[formName], function (instance) {
                    var statusField = formName + '_complete';

                    return instance[statusField];
                });

                var overallStatus = null;

                if (allStatuses.length > 0) {
                    if (allStatuses.every(function (status) {return status === '2';})) {
                        overallStatus = 2;
                    }
                    else if (allStatuses.every(function (status) {return status === '1';})) {
                        overallStatus = 1;
                    }
                    else if (allStatuses.every(function (status) {return status === '0';})) {
                        overallStatus = 0;
                    }
                    else {
                        overallStatus = 3;
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

                console.log(repeatInstances);

                var newInstanceIndex = Object.keys(repeatInstances).length + 1;
                var newInstance = {};

                // todo must not copy non-data fields
                $.each(data.dataDictionary, function (index, field) {
                    console.log(field['field_name']);

                    if (field['field_name'] && field['field_type']) {
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

                // newInstance[form + '_complete'] = '';

                if (newInstanceIndex === 1) {
                    Vue.set(data.redcapData[data.selectedRecordId]['repeat_instances'][data.eventId], form, {
                        1: newInstance
                    });
                }
                else {
                    Vue.set(repeatInstances, newInstanceIndex, newInstance);
                }

                this.$forceUpdate();
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
            'dictionary'
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

    var app = new Vue({
        el: '#app',
        data: UIOWA_EasyEdit,
        mixins: [mixin],
        watch: {
            redcapData: {
                deep: true,
                handler() {
                    saveRedcapData(this._data.redcapData);
                }
            }
        }
    });

    $(document).on('click', '.edit-button', function () {
        console.log('test');

        var $editButton = $(this);
        var fieldName = $editButton.attr('data-edit');
        var $editField = $("#edit-" + fieldName);
        var prop = 'readonly';

        if ($editField.is('div')) {
            prop = 'disabled';
            $editField = $editField.find('input');
        }
        else if ($editField.is('select')) {
            prop = 'disabled';
        }

        $editField.prop(prop, !$editField.prop(prop));

        if ($editButton.find('i').hasClass('fa-edit')) {
            $editButton
                .removeClass('btn-primary')
                .addClass('btn-success')
                .find('i')
                .removeClass('fa-edit')
                .addClass('fa-check');
        }
        else {
            $editButton
                .addClass('btn-primary')
                .removeClass('btn-success')
                .find('i')
                .addClass('fa-edit')
                .removeClass('fa-check');
        }
    });

    // $('#recordSelect').change(function () {
    //     var href = new URL(window.location);
    //     href.searchParams.set('record_id', $(this).val());
    //     window.location.href = href;
    // });

    $(document).on('change', 'select', function () {
        var select = $(this);
        var field = select.attr('data-name');
        var editButton = $("button[data-clipboard-target='#edit-" + field + "']");

        editButton.attr('data-clipboard-text', $('option:selected', select).text());
    });

    $('.add-repeat-instance').click(function () {
        var form = $(this).attr('data-add');

        app.addRepeatInstance(form);

        // $('collapse_' + form + '__' + newInstanceIndex).addClass("show");
    });

    var copyButtonClass = '.copy-button';

    $(copyButtonClass).popover({
        trigger: 'click',
        placement: 'bottom'
    });

    var clipboard = new ClipboardJS(copyButtonClass);

    clipboard.on('success', function(e) {
        setTooltip('Copied!');
        hideTooltip();
    });
    clipboard.on('error', function(e) {
        setTooltip('Failed!');
        hideTooltip();
    });

    $('.collapse').on('show.bs.collapse', function(e) {
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
    });

    $('[data-toggle="popover"]').popover();

    // $('.save-button').click(function () {
    // });

    $('.no-collapse').click(function (e) {
        e.stopPropagation();
    });

    $('#accordion').on('shown.bs.collapse', function (e) {
        saveActiveAccordionPanel('accordion-activePanel', e);
    });

    $('#accordion').on('hidden.bs.collapse', function (e) {
        clearActiveAccordionPanel('accordion-activePanel', e);
    });

    restoreAccordionPanel('accordion-activePanel', '#accordion');
});

function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

function saveRedcapData(data) {
    var saveMsg = $('#saveMsg');

    saveMsg
        .removeClass('badge-success')
        .addClass('badge-primary')
        .html('<i class="fas fa-spinner fa-spin"></i> Saving...');

    $.ajax({
        url: UIOWA_EasyEdit.requestUrl + '&type=save',
        type: 'POST',
        data: JSON.stringify(data),
        success: function(result) {
            saveMsg
                .removeClass('badge-primary')
                .addClass('badge-success')
                .html('<i class="fas fa-check"></i> All changes saved');

            console.log(result);
        }
    })
}

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

function restoreAccordionPanel(storageKey, accordionId) {
    var activeItem = localStorage.getItem(storageKey);
    if (activeItem) {
        $("#" + activeItem).addClass("show");
    }
}

function saveActiveAccordionPanel(storageKey, e) {
    localStorage.setItem(storageKey, e.target.id);
}

function clearActiveAccordionPanel(storageKey, e) {
    localStorage.removeItem(storageKey);
}
