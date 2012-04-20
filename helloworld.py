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
        entity = args['entity']
        
        if not model or not issubclass(model, db.Model):
            raise TypeError()            
        if not entityDictionary:
            raise "entity dictionary is missing"
        
        modelName = model.__name__
        modelKeyType = model.keyType
        modelKeyValue = entity.key().id_or_name() if entity else None
        
        entityDictionary['modelName'] = modelName
        entityDictionary['key'] = {'type':modelKeyType, 'value':modelKeyValue}
        entityDictionary['parent'] = args['parentName']
        entityDictionary['parentIndex'] = args['parentIndex']
        entityDictionary['index'] = args['index'] + 1
    
            
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
    collectionModels = ['InvoiceItem']
    keyType = Entity.KeyType.ID 
        
''' invoice items are grouped by invoice key '''
class InvoiceItem(db.Model):
    description = db.TextProperty()
    quantity = db.StringProperty()
    unitPrice = db.StringProperty()
    invoice = db.ReferenceProperty(Invoice)
    keyType = Entity.KeyType.ID


#"""""""""""""""""
#request handlers 
#"""""""""""""""""
#''' get: /invoice?id=12
#post: customer=124&vechile=1413&labour=134&notes="sdfsd"
#'''
#class InvoiceRequest(webapp2.RequestHandler):
#    def get(self):
#        invoiceId = self.request.get('id')
#        invoice = Invoice.get_by_id(invoiceId)            
#    
#    def post(self):    
#        def saveInvoice():                                    
#            invoiceItemIds = map(lambda id:Invoice.get_by_id(id), self.request.get_all('items'))
#            
#            if invoiceItemIds:
#                ownerId = self.request.get('customer')
#                vechileId = self.request.get('vechile')
#                
#                owner = Customer.get_by_id(ownerId)
#                vechile = Vechile.get_by_id(vechileId)
#                
#                invoice = EntityRequest.buildEntityFromRequest(Invoice, self.request)                
#                invoice.owner = owner
#                invoice.vechile = vechile
##                invoice.put()
#                         
#                for invoiceItem in invoiceItemIds:
#                    invoiceItem.invoice = invoice
##                    invoiceItem.put()
#                                
#        db.run_in_transaction(saveInvoice)

'''
only non reference properties are saved in this method 
'''

class EntityCollectionRequest(webapp2.RequestHandler):
    def get(self): 
        retData = []     
        parentName = self.request.get('model');
        parentIndex = self.request.get('index')
        parent = eval(parentName)       
        entity = EntityRequest.getEntityFromRequest(parent, self.request) 
           
       
        if entity:
            itemModelName = self.request.get('itemModelName')  
            collectionEntities = getattr(entity, itemModelName.lower() + '_set')
                                
            if collectionEntities:
                
                for index, entity in enumerate(collectionEntities):
                    model = entity.__class__                    
                    entityDictionary = Entity.dictionarizeEntity(model, entity)
                    additionalParamsForEntity = {'model':model, 
                                                 'entity':entity,
                                                 'parent':parentName,
                                                 'parentIndex':parentIndex,
                                                 'index':index+1}
                    
                    Entity.addIdParamsForEntityDictionary(entityDictionary, **additionalParamsForEntity)
                    
                    retData.append(entityDictionary)
                    
            ''' add another empty record for continous input '''
            emptyRecord = Entity.dictionarizeEntity(eval(itemModelName),None)
             
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
    def getEntityFromRequest(model, request):        
        if not issubclass(model, db.Model):
            raise TypeError()
        if not isinstance(request, webapp2.Request):
            raise TypeError()
        
        # based on the type of query key to determine
        # how to query the entity i.e. by id or by keyname  
        queryKey = json.loads(request.get('key'))
        queryType = queryKey['type']
        queryValue = queryKey['value']
                   
        entity = getattr(model, 'get_by_' + queryType)(queryValue)
        
        return entity 
    
    @staticmethod
    def setEntityFromRequestPayload(entity, requestPayload):
        fields = Entity.getNoneRefereceProperties(entity.__class__)
        for field in fields:
            setattr(entity,field,requestPayload[field]) 
            
        return entity
            
#    @staticmethod
#    def buildEntityFromRequest(model, request):
#        if not issubclass(model, db.Model):
#            raise TypeError()
#        if not isinstance(request, webapp2.Request):
#            raise TypeError()
#       
#        instance = model()
#        
#        fields = Entity.getNoneRefereceProperties(model);    
#        for field in fields:
#            value = request.get(field)
#            if value:
#                setattr(instance, field, request.get(field))        
#        
#        return instance
           
    def get(self):        
        model = eval(self.request.get('model'))        
        entity = EntityRequest.getEntityFromRequest(model, self.request) 
        outputDict = Entity.dictionarizeEntity(model, entity)
                              
        self.response.out.write(json.dumps(outputDict))
        
        
    def post(self):
        model = eval(self.request.get('model'))
        entityKey = json.loads(self.request.get('key'));
        
        if entityKey['type'] == Entity.KeyType.KEYNAME:
            newEntity = model(key_name=entityKey['value'])
        else:
            newEntity = model()
            
        requestPayload = json.loads(self.request.body)
        newEntity = EntityRequest.setEntityFromRequestPayload(newEntity, requestPayload)
        newEntity.put()
        
        requestPayload['id'] = newEntity.key().id_or_name()
        self.response.out.write(json.dumps(requestPayload))
#        if entityKeyJsonData:
#            keyObj = json.loads(entityKeyJsonData)
#            entity = 
#        if (model.keyType == Entity.KeyType.KEYNAME):
#             
#        requestPayload = json.loads(self.request.body)
#        requestPayload['id'] = 1
#        self.response.out.write(json.dumps(requestPayload))
#        entity = EntityRequest.buildEntityFromRequest(model, self.request)
#        entity.put() 

        ''' get the rejference , create entity and set the referecne'''
        

    def put(self):
        ''' get entity by it's key and value '''
        model = eval(self.request.get('model'))
        entity = EntityRequest.getEntityFromRequest(model, self.request)
        
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
