
/**
 * This module is to construct a editable panel for each filed
 * of the entity, when double clicking on the field, input 
 * elements (text field, save buttn and cancel butotn) will show
 * up, cancel button is to cancle this input, previous value
 * remains on the page, and save will update the
 * entity attribute into the database.
 *
 * usage:
 * data = {label1 : "value1", label2 : "value2"}
 * editablePanelForEntity = new EditablePanel(data)  
 */
(function($){

  var EditModes = {
    NEW  : 'new',
    READ  : 'read',
    UPDATE : 'update'
  };

  var Buttons = {
    SAVE: 'save',
    CANCEL: 'cancel',
    NEW: 'new'
  };

  var getOrCreateContainer = function(cfg) {
    if (!cfg.id) throw "dont know the model for the container";
    if (!cfg.type) throw "dont know the type of the container";

    var root = cfg.rootSelector || '#content';
    var containerSuffix = "-container"  
    var container = $("#" + cfg.id + containerSuffix);

    if ( !container.length ) {
      var html = _.template ($("#tpl-container").html(), {
        id: cfg.id,
        type: cfg.type         
      });

      container = $( html );
      $(root).append(container);
    }

    return container;
  };
 
  // @usage:
  // var vechile = new Entity( {
          //   name : 'Vechile',
          //   key: {type: 'key_name', value: rego}            
          // });
  var Entity = Backbone.Model.extend( { 

    initialize: function (cfg) {
      if (!cfg.name)
        throw "name of the entity is missing";
      if (!cfg.key)
        throw "query id for the entity is missing"  
      if (!cfg.key.type)
        throw "type of query for entity is missing" 

      this.modelName = cfg.name;
      this.key = cfg.key;

      // resouce key for this entity is represented as
      //  a json string with key type and value    
      var obj = {};

      // guess default value from key type
      if (this.key.type == 'key_name')
        guessValue = 'radom-nonsence';
      if (this.key.type == 'id')
        guessValue = -1;

      value = this.key.value || guessValue;
      obj[this.key.type] = value;
      var idValue =  JSON.stringify( obj );

      // build resource url for this entity
      this.keyUrl =  "model=" + this.modelName + "&id=" + idValue;
      this.url = '/entity' + "?" + this.keyUrl

      _.bindAll(this, 'attrsChange');
      this.bind('change', this.attrsChange);
    },

    attrsChange: function() {
      // create a new view if any entity attributes changed
      var newView = new FieldsView({model:this});
      
      // also need to change referenced entities status
      var referenceList = JSON.parse(this.get('references'));

      _.each(referenceList, function(referenceMetaData) {
          var modelName = referenceMetaData.modelName;
          var referenceKeyType = referenceMetaData.keyType;
          var referenceKeyValue = referenceMetaData.keyValue;

          if (! this.isNew()) {
            var referencedEntity = new Entity({
              name : modelName,
              key: { type: referenceKeyType, value: referenceKeyValue }
            });
            referencedEntity.fetch();
          }

          else {
            // if the entity IS NEW, remove any referenced entity
            // containers for previous searched entity
            $('#' + modelName + '-container').remove();
          }
      }, this);
    }
  });
  exports.Entity = Entity;

  var EntityCollection = Backbone.Collection.extend({
    
    initialize: function(cfg) {
      if (!cfg.itemModelName)
        throw "type of the colleciton item is missing"
      if (!cfg.referencedBy)
        throw "dont know how this collection is referecned"

      this.itemModelName = cfg.itemModelName;
      this.referencedBy = cfg.referencedBy; 
      this.keyModel = this.referencedBy;

      this.url = "/entityCollection?itemModelName=" + this.itemModelName + "&" + this.referencedBy.keyUrl;
    },

    parse: function(response) {
      // _.each($.makeArray(response), function(obj){
      //   var entity = new Entity( {
      //       name : this.itemModelName,
      //       key: {type: 'key_name'}            
      //     });

      //     entity.set(obj);  
      // }, this);          
    }
  });
  exports.EntityCollection = EntityCollection;


  // @usage:
  // var newView = new FieldsView({model:entityinstance});  
  //
  var FieldsView = Backbone.View.extend({

    initialize : function(cfg) {      
      if (!cfg.model)
        throw "entity instance of required for fields view"

      this.model = cfg.model;

      _.bindAll(this, 'render', 'newEntity');     

      this.render();
    },

    events: {
      'click .link-button.entity.save' : 'newEntity'
    },

    newEntity: function() {        
      var dataObj = {}; 
      var inputs = $('#' + this.model.modelName + '-container').find('.field-container');

      // extract key and value from eachinput box
      _.each(inputs, function(el) {      
        var idDataArr = $(el).find('.field-name').attr('id').split('-');        
        if (!idDataArr.length == 3)
          throw ("id for the field is not valid");

        var key = idDataArr[1];
        var value = $(el).find('.value-input').val();

        // only set vlaue for those fields that
        // the vlaue has explictily typed in         
        if(value)  
          dataObj[key] = value;    
      });          
      
      this.model.save(dataObj, {wait : true});    
    },    

    render: function() {
      // display view for each field
      var fields = this.model.changedAttributes();
      for (field in fields) {
        var name = field;
        var value = fields[name];

        // render view for individule field
        var fieldView = new FieldView({
          name: name,
          value: value, 
          mode : this.model.isNew()? EditModes.NEW : EditModes.READ,      
          model: this.model
        })
      }

      var entityContainer = getOrCreateContainer({          
          id: this.model.modelName,
          type: 'entity'
        });

      var hasSaveLinkButton = entityContainer.has($('.link-button.save')).length;

      // also add a save and cancle button if the entity
      // is going to be created
      if (this.model.isNew() && !hasSaveLinkButton) {
        var saveBtnEl = $(_.template($("#tpl-link-btn").html(), {
          btnType : Buttons.SAVE,
          modelType: 'entity',
          btnText : 'Save this ' + this.model.modelName
        }));

        entityContainer.append(saveBtnEl);
        this.setElement(entityContainer);  
        $(this.el).unbind();  
      }
      else if (!this.model.isNew() && hasSaveLinkButton) {
        entityContainer.find('.link-button.save').remove();
      }
    }
  });
 
  // @usage:
  //  var fieldView = new FieldView({
  //         name: name;
  //         value: value;
  //         mode: this.isNew? EditModes.NEW : EditModes.READ
  //       })
  var FieldView = Backbone.View.extend({

    initialize : function(cfg) {
      if (!cfg.name) throw "name of the field is requried";
      if (!cfg.mode) throw "dont know the mode display the field";
      if (!cfg.model) throw "dont know what this field belongs to"
    
      this.name = cfg.name;
      this.mode = cfg.mode;
      this.model = cfg.model;
      this.value = cfg.value || 'N/A';

      _.bindAll(this, 'render', 
                      'saveField', 
                      'cancelField', 
                      'changeView');

      this.render();
    },

    events: {
      'dblclick .field-value'    : "changeView",
      'click .link-button.field.save'       : "saveField",
      'click .link-button.field.cancel'     : "cancelField"
    },

    getFieldNameFromInput: function (input) {
      // assuming input box must have a label bound with it      
      var fieldDataArr = input.siblings('.field-name').attr('id').split('-');

      if (fieldDataArr.length != 3)
        throw "field id is not valid"

      return fieldDataArr[1];
    },

    saveField: function(e) {
      var inputEl = $(e.currentTarget);
      var fieldName = this.getFieldNameFromInput(inputEl);
      var fieldValue = inputEl.val();
      var saveObj = {};

      saveObj[fieldName] = fieldValue;
      this.model.save(saveObj, {wait:true});      
    },

    cancelField: function(e) {
      // var view = new FiledView(this.model, EditModes.READ);
      console.log('cancel butoton clicked');
    },

    changeView: function(e) {
      // if (!this.model.get('readOnly')) {
      //   var view = new FieldView(this.model, EditModes.EDIT));
      // }

      var fieldName = this.getFieldNameFromInput($(e.currentTarget));      

      var newView = new FieldView( {
        mode: EditModes.UPDATE,
        name: fieldName,
        model: this.model
      })
    },
  
    render : function() {
      var fieldHtml = "";
      var fieldId = [this.model, this.name, 'field'].join('-');

      switch (this.mode) {
        case EditModes.NEW:          
          fieldHtml = _.template( $("#tpl-field-new").html(), {
            fieldName : this.name,
            fieldId   : fieldId
          });
          break;

        case EditModes.READ:          
          fieldHtml = _.template( $("#tpl-field-read").html(), {
            fieldName   : this.name,
            fieldValue  : this.value,
            fieldId     : fieldId
          });
          break;

        case EditModes.UPDATE:
          fieldHtml = _.template( $("#tpl-field-new").html(), {
            fieldName: this.name,
            fieldId : fieldId
          });          
          fieldHtml += _.template( $("#tpl-link-btn").html(), {
            btnText: "Save",
            btnType: Buttons.SAVE,
            modelType: 'field'
          });
          fieldHtml += _.template( $("#tpl-link-btn").html(), {
            btnText: "Cancel",
            btnType: Buttons.CANCEL,
            modelType: 'field'
          });
          break;    
      }

      // append field element to the field container
      var fieldContainer = getOrCreateContainer({
        id: [this.model.modelName, this.name].join('-'),
        type: 'field'
      });

      fieldContainer.empty();   
      fieldContainer.append( $(fieldHtml) ); 

      // append field container to entity container      
      var entityContainer = getOrCreateContainer({
        id: this.model.modelName,         
        type: 'entity'
      });
        
      if ( ! entityContainer.has(fieldContainer).length ) {
        entityContainer.append(fieldContainer);  
      }

      this.setElement(fieldContainer);
      $(this.el).unbind();  
    }
  });
})(jQuery);