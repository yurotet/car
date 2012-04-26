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

      if (cfg.index == null || typeof cfg.index == 'undefined')
        this.index = '';
      else
        this.index = cfg.index;

      _.bindAll(this, 'attrsChange', 'setUrl', 'keyChange', 'setReferencedBy', 'addOrReplaceUrlParam');

      this.modelName = cfg.name;
      this.key = cfg.key;
     /// this.parent = cfg.parent;
     // this.index = cfg.index || '';
     //this.parentIndex = cfg.parentIndex || '';
      this.preSave = cfg.preSave;

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
      this.setUrl(this.get('key'));
    },

    setUrl: function(keyObj) {
      if (!$.isPlainObject(keyObj))
        throw "key object must be an Object";

      this.keyUrl =  "model=" + this.modelName + "&key=" +  JSON.stringify( keyObj );

   //  if ($(this.index).length) {
    //    this.keyUrl += "&index=" + this.index;
    //  }

      if(this.preSave) {
        this.keyUrl += "&preSave=1"
      }     

      this.url = '/entity' + "?" + this.keyUrl;      
    },

    addOrReplaceUrlParam: function(key, value) {
      var keyReg = new RegExp(key + "=", "i");
      var keyStr = key + "=" + value;

      if(this.url.match(keyReg)) {
        var replaceReg = new RegExp(key + "=[^&]+", "i");
        this.url = this.url.replace(replaceReg, keyStr);
      }
      else {
        this.url = this.url + "&" + keyStr;
      }
    },

    setReferencedBy:function(referencedByEntityMeta) {
      if (!$.isPlainObject(referencedByEntityMeta.key))
        throw "refernced entitny key is wrong type or not specified";
      if (!referencedByEntityMeta.modelName)
        throw "model name for the referecedby entity is not specified";

      this.referencedByEntityMeta = referencedByEntityMeta;
      this.addOrReplaceUrlParam('referencedBy', JSON.stringify(referencedByEntityMeta));      
    },

    attrsChange: function() {
      // create a new view if any entity attributes changed
      var newView = new EntityView({model:this});
   
      // fetch referenced entities      
      _.each(this.get('references'), function(referenceMeta, referenceIndex) {
          var modelName = referenceMeta.modelName;
          var referenceKeyType = referenceMeta.key.type;
          var referenceKeyValue = referenceMeta.key.value;

          if (! this.isNew()) {
            var referencedEntity = new Entity({
              name : modelName,
              key: { type: referenceKeyType, value: referenceKeyValue } ,
              index: referenceIndex
            });

            var referencedByEntityMeta = {
              key: this.key,
              modelName : this.modelName,
              index: this.index              
            };            
            referencedEntity.setReferencedBy(referencedByEntityMeta);
            referencedEntity.fetch();
          }
      }, this);

      // fetch entity collecions and parse each item      
      _.each(this.get('collections'), function(collectionModelName){
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

      this.url = "/entityCollection?itemModelName=" + this.itemModelName + "&" + this.referencedBy.keyUrl;
    },

    parse: function(response) {

      _.each($.makeArray(response), function(collectionItem) {             
        var entity = new Entity( {
            name : this.itemModelName,
            key: collectionItem.key
           //index: collectionItem.index,
           // parentIndex : collectionItem.parentIndex,
           // parent : collectionItem.parent
          });

          var referencedByEntityMeta = {
            key: this.referencedBy.key,
            modelName: this.referencedBy.modelName,
            index: referencedBy.index
          };

          entity.setReferencedBy(referencedByEntityMeta);
          entity.set(collectionItem);

      }, this);

      // if the referenced entity allow collection items to be continuously created, then
      // besides fetching all already stored collection items, an extra input item needs 
      // to be fetched.
      //var openCollecitonsOfReferencedBy = this.referencedBy.get('openCollections');  
     // if (openCollecitonsOfReferencedBy) {
      //    var openToNewItems =  _.find(openCollecitonsOfReferencedBy, 
       //                                 function(e) { return e == this.itemModelName}, this);        
      //    if (openToNewItems) {
       //     // fetch an input colleciton item
       //     var inputEntity = new Entity( {
        //        name : this.itemModelName,
                // TODO:: this is harde coded , WRONG!!!, entity my not 
                // need to know the type, server side can fiture it out,
                // refactor this later
       //         key: {type: 'id'},
       //         parent: this.referencedBy.modelName,
        //        parentIndex: this.referencedBy.index,
         //      index: 1,        
         //   });

            // TODO:: referencedby url might need to be refactored
            // to be constructed just inside entity itself, doesnt
            // need to configure from outside 
          //  var referenceKeyObj = {referenceModel: this.referencedBy.modelName,
           //                         referenceKey: this.referencedBy.key};

        //    inputEntity.setReferenceKey(referenceKeyObj);          
            //inputEntity.fetch();

         //   console.log(this.referencedBy);
       //}
      //}     
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
      var referencedByEntityMeta = this.model.referencedByEntityMeta;
      if (referencedByEntityMeta) {
        var parentkeyContainer = $('#' + referencedByEntityMeta.modelName + referencedByEntityMeta.index + '-key-container');
      }
      
      if(parentkeyContainer && parentkeyContainer.length) { 

       var parentKeyJsonStr = parentkeyContainer.find('.field-value').text();         
        if (!parentKeyJsonStr) 
          throw ("parent key json must not be empty if entity's parent exits") 

        // var referencedKeyObj = {referenceModel: this.model.referencedByEntityMeta.modelName,
        //                         referenceKey: parentKeyJsonStr}
        // this.model.setReferenceKey(referencedKeyObj);
      }

      this.model.save(dataObj, {wait : true});
    },

    render: function() {
      // fileds that need to display
      includedDisplayFields = ['key'];

      // fields that dont need to display
      excludeDisplayFields = ['id', 'model', 'name', 'parent', 'collections', 'references', 'parentIndex', 'index', 'modelName', 'openCollections'];

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

      var referencedByEntityMeta = this.model.referencedByEntityMeta;
      var entityContainer = getOrCreateContainer({          
          id: this.model.modelName + this.model.index,
          type: 'entity',
          rootSelector: referencedByEntityMeta? '#' + referencedByEntityMeta.modelName + referencedByEntityMeta.index + '-container' : null
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
      
      var referencedByEntityMeta = this.model.referencedByEntityMeta;

      // append field container to entity container      
      var entityContainer = getOrCreateContainer({
        id: this.model.modelName + this.model.index,
        type: 'entity',
        rootSelector: referencedByEntityMeta? '#' + referencedByEntityMeta.modelName + referencedByEntityMeta.index + '-container' : null
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