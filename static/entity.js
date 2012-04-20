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
        throw "key for the entity is missing"  
      if (!cfg.key.type)
        throw "type of query for entity is missing"
      if (cfg.parent && !cfg.index)
        throw "this entity has a parent but child index is not specified" 

      _.bindAll(this, 'attrsChange', 'setUrl', 'keyChange');

      this.modelName = cfg.name;
      this.key = cfg.key;
      this.parent =cfg.parent
      this.index = cfg.index || '';
      this.parentIndex = cfg.parentIndex || '';

      // resouce key for this entity is represented as
      //  a json string with key type and value    
      // var obj = {};

      // guess default value from key type
      if (this.key.type == 'key_name')
        guessValue = 'guess-value';
      if (this.key.type == 'id')
        guessValue = -1;

      this.key.value = this.key.value || guessValue;  
      this.setUrl(this.key);

      this.bind('change:key', this.keyChange);    
      this.bind('change', this.attrsChange);
    },

    keyChange: function() {
      this.setUrl(JSON.parse(this.get('key')));
    },

    setUrl: function(keyObj) {
      if (!$.isPlainObject(keyObj))
        throw "key object must be an instance of Object";

      this.keyUrl =  "model=" + this.modelName + "&key=" +  JSON.stringify( keyObj );

      if ($(this.index).length) {
        this.keyUrl += "&index=" + this.index;
      }

      this.url = '/entity' + "?" + this.keyUrl;
    },

    attrsChange: function() {
      // create a new view if any entity attributes changed
      var newView = new EntityView({model:this});
   
      // fetch referenced entities
      var referenceList = JSON.parse(this.get('references'));

      _.each(referenceList, function(referenceMetaData, referenceIndex) {
          var modelName = referenceMetaData.modelName;
          var referenceKeyType = referenceMetaData.keyType;
          var referenceKeyValue = referenceMetaData.keyValue;

          if (! this.isNew()) {
            var referencedEntity = new Entity({
              name : modelName,
              key: { type: referenceKeyType, value: referenceKeyValue },
              parent: this.modelName,
              parentIndex: this.index,
              index: referenceIndex + 1
            });
            referencedEntity.fetch();
          }
      }, this);

      // fetch entity collecions
      var collectionList = JSON.parse(this.get('collections'));       
      _.each(collectionList, function(collectionModelName){
        if (! this.isNew()) {
          var collection = new EntityCollection({
            itemModelName:collectionModelName,
            referencedBy: this
          });

          collection.fetch();
        }
      }, this);      
    }
  });
  exports.Entity = Entity;

  var EntityCollection = Backbone.Collection.extend({
    
    initialize: function(cfg) {
      if (!cfg.itemModelName)
        throw "type of the colleciton item is missing"
      if (! (cfg.referencedBy && cfg.referencedBy instanceof Entity) )
        throw "the entity that reference this collection is missing"

      this.itemModelName = cfg.itemModelName;
      this.referencedBy = cfg.referencedBy; 
      this.keyModel = this.referencedBy;

      this.url = "/entityCollection?itemModelName=" + this.itemModelName + "&" + this.referencedBy.keyUrl;
    },

    parse: function(response) {
      _.each($.makeArray(response), function(entityData){
        var entity = new Entity( {
            name : entityData.modelName,
            key: entityData.key,
            index: entityData.index,
            parentIndex : entityData.parentIndex,
            parent : entityData.parent         
          });

          entity.set(entityData);

      }, this);          
    }
  });
  exports.EntityCollection = EntityCollection;


  // @usage:
  // var newView = new EntityView({model:entityinstance});  
  //
  var EntityView = Backbone.View.extend({

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

    newEntity: function(e) {
      
      e.stopImmediatePropagation();

      var parentEl = $(e.currentTarget).parent('.entity-container')
      var inputs = parentEl.find('.field-container');      
      var dataObj = {};

      // extract key and value from eachinput box
      _.each(inputs, function(el) {    

        var idDataArr = $(el).find('.field-name').attr('id').split('-');        
        if (!idDataArr.length == 3)
          throw ("id for the field is not valid");

        var fieldName = idDataArr[1];
        var fieldValue = $(el).find('.value-input').val();

        // only set vlaue for those fields that
        // the vlaue has explictily typed in         
        if(fieldValue)  
          dataObj[fieldName] = fieldValue;    
      });          

      // add referncedby entity to query url to set the relationship
      var parentkeyContainer = $('#' + this.model.parent + this.model.parentIndex + '-key-container');
      
      if(parentkeyContainer.length) {                
       
       var parentKeyJsonStr = parentkeyContainer.find('.field-value').text();         
        if (!parentKeyJsonStr) 
          throw ("parent key json must not be empty if entity's parent exits") 

        var referencedKeyObj = {referenceModel: this.model.parent,
                                referenceKey: parentKeyJsonStr}
        this.model.url += '&referencedBy=' + JSON.stringify(referencedKeyObj);
      }

      this.model.save(dataObj, {wait : true});
    },

    render: function() {
      // fileds that need to display
      includedDisplayFields = ['key'];

      // fields that dont need to display
      excludeDisplayFields = ['id','model','name','parent','parentIndex','index','modelName'];

      // display view for each field
      var fields = this.model.attributes;    

      _.each(fields, function(fieldValue,fieldName) {

        try {          
          if (!fieldValue) {
           throw "render null values";
          }

          if (_.find(includedDisplayFields, function(e){ return e == fieldName})) {            
            throw "render inlcuded fields values";
          }
          
          // render non-json object fields
          JSON.parse(fieldValue);
        }
        catch(e){

          if (!_.find(excludeDisplayFields, function(e) {return e == fieldName})) { 
            // stringfy json values
            if($.isPlainObject(fieldValue)) {
              fieldValue = JSON.stringify(fieldValue);              
            }

            // only render those fields not in excluded fields    
            var newView = new EntityAttributeView({
              name: fieldName,
              value: fieldValue, 
              mode : this.model.isNew()? EditModes.NEW : EditModes.READ,      
              model: this.model
            });
          }  
        }        
      }, this);

      var entityContainer = getOrCreateContainer({          
          id: this.model.modelName + this.model.index,
          type: 'entity',
          rootSelector: this.model.parent? '#' + this.model.parent + this.model.parentIndex + '-container' : null
        });

      
      if (this.model.isNew()) {
        // clean any previous entity referecnes if this entity is new
        entityContainer.find('.entity-container').remove();    
      }

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
      }

      else if (!this.model.isNew() && hasSaveLinkButton) {
        entityContainer.find('.link-button.save').remove();
      }

      this.setElement(entityContainer);  
      $(this.el).unbind();
    }
  });

  // @usage
  // var newView = new EntityAttributeView({
  //   name: name,
  //   value: value, 
  //   mode : this.model.isNew()? EditModes.NEW : EditModes.READ,      
  //   model: this.model
  // })
  var EntityAttributeView = Backbone.View.extend({

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

    getFieldValueFromInput: function(input) {
      var fieldInputEl = input.siblings('.value-input');
      return fieldInputEl.val();
    },

    saveField: function(e) {
      var inputEl = $(e.currentTarget);
      var fieldName = this.getFieldNameFromInput(inputEl);
      var fieldValue = this.getFieldValueFromInput(inputEl);

      var saveObj = {};
      saveObj[fieldName] = fieldValue;

      this.model.save(saveObj, {wait:true});      
    },

    cancelField: function(e) {
      // var view = new EntityAttributeView(this.model, EditModes.READ);
      // var view = new FiledView(this.model, EditModes.READ);
      console.log('cancel butoton clicked');
    },

    changeView: function(e) {
      // if (!this.model.get('readOnly')) {
      //   var view = new EntityAttributeView(this.model, EditModes.EDIT));
      // }

      var fieldName = this.getFieldNameFromInput($(e.currentTarget));      

      var newView = new EntityAttributeView( {
        mode: EditModes.UPDATE,
        name: fieldName,
        model: this.model
      })
    },
  
    render : function() {
      var fieldHtml = "";
      var fieldId = [this.model.modelName + this.model.index, this.name, 'field'].join('-');

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
        id: [this.model.modelName + this.model.index, this.name].join('-'),
        type: 'field'
      });

      fieldContainer.empty();      
      fieldContainer.append($(fieldHtml));

      // append field container to entity container
      var entityContainer = getOrCreateContainer({
        id: this.model.modelName + this.model.index,         
        type: 'entity',
        rootSelector: this.model.parent? '#' + this.model.parent + this.model.parentIndex + '-container' : null
      });
        
      if ( ! entityContainer.has(fieldContainer).length ) {
        entityContainer.append(fieldContainer);  
      }
      
      // if the field is in edit mode, then set focus on it's text input box
      if (this.mode == EditModes.UPDATE) {
        fieldContainer.find('input[type="text"]').focus();
      }

      this.setElement(fieldContainer);
      $(this.el).unbind();  
    }
  });
})(jQuery);