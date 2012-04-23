from google.appengine.ext.webapp.util import run_wsgi_app
import webapp2
import jinja2
import os
import datetime
import json
import logging

from google.appengine.ext import db
from google.appengine.api import users

jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.join(os.path.dirname(__file__))))



class Entity:
    ''' key type enum '''
    class KeyType:
        ID = 'id'
        KEYNAME = 'key_name'
    
    @staticmethod
    def getNoneRefereceProperties(model):     
        if not issubclass(model, db.Model):
            raise TypeError()
        
        return [k for k, v in model.properties().items() if not isinstance(v, db.ReferenceProperty)]
    
    @staticmethod
    def getEntityFromKeyJson(model, queryKey):   
        if not issubclass(model, db.Model):
            raise TypeError()
        # based on the type of query key to determine
        # how to query the entity i.e. by id or by keyname  
        queryType = queryKey['type']
        queryValue = queryKey['value']
                
        entity = getattr(model, 'get_by_' + queryType)(queryValue)           
        
        return entity 
    
    @staticmethod
    def dictionarizeEntity(model, entity):
        ''' construct entity's none reference property list '''
        fields = Entity.getNoneRefereceProperties(model)        
        if entity:
            retDict = dict((field, getattr(entity,field)) for field in fields)
            retDict['id'] = entity.key().id_or_name()        
        else:
            retDict = dict((field, None) for field in fields)    
        
        ''' construct a reference property list '''
        referenceList = [] 
        if(hasattr(model,'referenceVars')): 
            for var in model.referenceVars:
                ''' construct refercne entity type '''
                referenceModelName = var.capitalize()            
                referenceModelKeyType = eval(referenceModelName).keyType
                
                ''' construct referecne entity value '''
                referenceModelKeyValue = None
                if entity:
                    referenceEntity = getattr(entity,var)
                    if referenceEntity:
                        referenceModelKeyValue = referenceEntity.key().id_or_name()
                
                referenceList.append({'modelName' : referenceModelName,
                                      'keyType' : referenceModelKeyType,
                                      'keyValue' : referenceModelKeyValue})                         
        retDict['references'] = json.dumps(referenceList)
                 
        ''' construct a collection list '''
        if(hasattr(model, 'collectionModels')):
            retDict['collections'] = json.dumps(model.collectionModels);
        else:
            retDict['collections'] = json.dumps([])
            
        return retDict
    
    ''' acceptable params:
        - entityDictionary
        - model
        - entity
        - parrentName
        - parentIndex
        - index
     '''
    @staticmethod        
    def addIdParamsForEntityDictionary(entityDictionary, **args):
        if not entityDictionary:
            raise "entity dictonary is missing"
            
        model = args['model']
        entity = args['entity'] if args.has_key('entity') else None
        
        if not model or not issubclass(model, db.Model):
            raise TypeError()            
        if not entityDictionary:
            raise "entity dictionary is missing"
        
        modelName = model.__name__
        modelKeyType = model.keyType
        modelKeyValue = entity.key().id_or_name() if entity else None
        
        entityDictionary['modelName'] = modelName
        entityDictionary['key'] = {'type':modelKeyType, 'value':modelKeyValue}
        entityDictionary['parent'] = args['parent'] if args.has_key('parent') else None
        entityDictionary['parentIndex'] = args['parentIndex'] if args.has_key('parentIndex') else None
        entityDictionary['index'] = args['index'] + 1 if args.has_key('index') else None
        
"""""""""
models

note: if some property is reference property
mkae sure the variable name is the lower case
of the name of the model 
"""""""""
class Customer(db.Model):
    firstName = db.StringProperty()
    lastname = db.StringProperty()
    contact = db.StringProperty()
    address = db.StringProperty()
    keyType = Entity.KeyType.ID
    
''' vechile search is the entry point
    of the system, all related info is
    abtained via vechile rego number '''
class Vechile(db.Model):
    rego = db.StringProperty()
    make = db.StringProperty()
    model = db.StringProperty()
    odometer = db.StringProperty()
    transmission = db.StringProperty()
    year = db.StringProperty()
    engineSize = db.StringProperty()
    fuleType = db.StringProperty()
    bodyType = db.StringProperty()
    driveType = db.StringProperty()
    turbo = db.StringProperty()
    color = db.StringProperty()
    customer = db.ReferenceProperty(Customer)
    collectionModels = ['Invoice']
    referenceVars = ['customer']
    keyType = Entity.KeyType.KEYNAME

''' invoice links to customer, vechile and invoice items.
    use refereceProperty back reference to check invoice 
    history of a particular vechile 
    invice key is to group invoice items '''    
class Invoice(db.Model):    
    vechile = db.ReferenceProperty(Vechile)
    labour = db.StringProperty()
    notes = db.TextProperty()
    acceptNewItem = db.BooleanProperty(default=True)    
    
    collectionModels = ['InvoiceItem']
    keyType = Entity.KeyType.ID
    preSave = True
    
        
''' invoice items are grouped by invoice key '''
class InvoiceItem(db.Model):
    description = db.TextProperty()
    quantity = db.StringProperty()
    unitPrice = db.StringProperty()
    invoice = db.ReferenceProperty(Invoice)
    keyType = Entity.KeyType.ID


class EntityCollectionRequest(webapp2.RequestHandler):
    def get(self): 
        retData = []     
        parentName = self.request.get('model')
        parentIndex = self.request.get('index')
        jsonKey = json.loads(self.request.get('key'))
        
        entity = Entity.getEntityFromKeyJson(eval(parentName), jsonKey)         
       
        if entity:
            itemModelName = self.request.get('itemModelName')  
            collectionEntities = getattr(entity, itemModelName.lower() + '_set')
            model = eval(itemModelName)
            
            if collectionEntities:                
                for index, entity in enumerate(collectionEntities):
                    entityDictionary = Entity.dictionarizeEntity(model, entity)
#                    additionalParamsForEntity = {'model':model, 
#                                                 'entity':entity,
#                                                 'parent':parentName,
#                                                 'parentIndex':parentIndex,
#                                                 'index':index+1}
#                    
#                    Entity.addIdParamsForEntityDictionary(entityDictionary, **additionalParamsForEntity)
                    
                    retData.append(entityDictionary)
                    
            ''' add another empty record for continous input '''
#            emptyEntityDictionary = Entity.dictionarizeEntity(eval(itemModelName),None)
#            additionalEmptyEntityDictionary = {'model':model,
#                                         'parent':parentName,
#                                         'parentIndex':parentIndex,
#                                         'index':0                                       
#                                         }
#            Entity.addIdParamsForEntityDictionary(emptyEntityDictionary, **additionalEmptyEntityDictionary)            
#            retData.append(emptyEntityDictionary)
             
        self.response.out.write(json.dumps(retData));
                                            

''' resouce: /entity?model=Customer&id=12 '''
class EntityRequest(webapp2.RequestHandler):
    @staticmethod
    def getDictFromParams(request, excludeKeys):
        if not isinstance(request, webapp2.Request):
            raise TypeError()
        if not isinstance(excludeKeys, list):
            raise TypeError()
        
        return dict((k, v) for k, v in request.GET.items() if not k in excludeKeys) 
    
    @staticmethod
    def setEntityFromRequestPayload(entity, requestPayload):
        fields = Entity.getNoneRefereceProperties(entity.__class__)
        for field in fields:
            setattr(entity,field,requestPayload[field]) 
            
        return entity
            
    @staticmethod
    def setEntityReferenceFromRequest(newEntity, referencedByJsonStr):
        if not isinstance(newEntity, db.Model):
            raise TypeError()
        if not isinstance(referencedByJsonStr, str):
            raise TypeError()        
                    
        referencedBy = json.loads(referencedByJsonStr);
        
        ''' get reference model from request '''        
        referenceModelName = referencedBy['referenceModel']
        if not referenceModelName:
            raise "referenced model name is not specified"
        referenceModel = eval(referenceModelName)
        
        ''' get reference key '''
        referenceKeyStr = referencedBy['referenceKey']
        if not referenceKeyStr:
            raise "referenced key is not specified"                
        referenceKey = json.loads(referenceKeyStr);
        
        ''' get referenced entity from datastore '''
        referenceEntity = Entity.getEntityFromKeyJson(referenceModel, referenceKey)
        
        ''' set new entity as the reference '''
        modelName = newEntity.__class__.__name__
        if hasattr(referenceEntity, modelName.lower()):
            setattr(referenceEntity, modelName.lower(), newEntity)
            referenceEntity.put()
        
        ''' set referenced entity as collection reference for the new entity '''
        if hasattr(newEntity, referenceModelName.lower()):
            setattr(newEntity, referenceModelName.lower(), referenceEntity)
            newEntity.put()
               
    def get(self):
        ''' get model and key for the request entity '''
        model = eval(self.request.get('model')) 
        jsonKey = json.loads(self.request.get('key'))
        
        ''' load entity '''
        entity = Entity.getEntityFromKeyJson(model, jsonKey)
        
        ''' create new entity for presave models '''
        if not entity and hasattr(model, 'preSave') and getattr(model, 'preSave'):
            keyType = jsonKey.type
            keyValue = jsonKey.value
            if keyType == Entity.KeyType.KEYNAME:
                entity = model(key_name=keyValue)
            else:
                entity = model()
            entity.put()
            EntityRequest.setEntityReferenceFromRequest(entity, self.request.get('referencedBy'))            
        
        ''' output entity body '''
        outputDict = Entity.dictionarizeEntity(model, entity)
        self.response.out.write(json.dumps(outputDict))
        
        
    def post(self):
        ''' get model '''
        modelName = self.request.get('model')
        model = eval(modelName)
        
        ''' get key '''
        keyJsonStr = self.request.get('key')          
        entityKey = json.loads(keyJsonStr);
        
        ''' create and fill data into the new created entity '''
        if entityKey['type'] == Entity.KeyType.KEYNAME:
            newEntity = model(key_name=entityKey['value'])
        else:
            newEntity = model()  
        requestPayload = json.loads(self.request.body)      
        newEntity = EntityRequest.setEntityFromRequestPayload(newEntity, requestPayload)
        newEntity.put()
        
        ''' set returned key value '''
        entityKey['value'] = newEntity.key().id_or_name()
                
        ''' set all references for the entity '''
        referencedByStr = self.request.get('referencedBy')
        if referencedByStr:
            EntityRequest.setEntityReferenceFromRequest(newEntity,referencedByStr)       
            
        ''' construct response key info '''
        requestPayload['id'] = newEntity.key().id_or_name()
        requestPayload['key'] = json.dumps(entityKey)
        
        ''' output response '''
        self.response.out.write(json.dumps(requestPayload))

    def put(self):
        ''' get entity by it's key and value '''
        model = eval(self.request.get('model'))
        jsonkey = json.loads(self.request.get('key'))
        entity = Entity.getEntityFromKeyJson(model, jsonkey)
        
        ''' update entity with request payload ''' 
        requestPayload = json.loads(self.request.body)     
        entity = EntityRequest.setEntityFromRequestPayload(entity, requestPayload)                
        entity.put()

''' application entry point '''
class Main(webapp2.RequestHandler):
    def get(self):
        template = jinja_environment.get_template('index.html')
        tplVals = {
            'title' : "Car",
            'year'  : datetime.datetime.now().year,
            'company' :   "my-compnay"        
        }
        
        self.response.out.write(template.render(tplVals))

class Data(webapp2.RequestHandler):
    def get(self):
        customer = Customer()
        customer.lastname = 'good'
        customer.firstName = 'test'
        customer.put()
        
        vechile = Vechile.get_by_key_name('t1')
        vechile.customer = customer
        vechile.put()       
        
        self.response.out.write('data imported')
        
''' applicaiton configrations '''        
app = webapp2.WSGIApplication([('/', Main),
                               ('/entity', EntityRequest), 
                               ('/data',Data),
                               ('/entityCollection',EntityCollectionRequest)],
                              debug=True)
def main():
    run_wsgi_app(app)
if __name__ == "__main__":
    main()
