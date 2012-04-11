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

"""""""""""""""""
helper functions 
"""""""""""""""""
def getDictFromParams(request, excludeKeys):
    if not isinstance(request, webapp2.Request):
        raise TypeError()
    if not isinstance(excludeKeys, list):
        raise TypeError()
    
    return dict((k, v) for k, v in request.GET.items() if not k in excludeKeys) 

def getNoneRefereceProperties(model):     
    if not issubclass(model, db.Model):
        raise TypeError()
    
    return [k for k, v in model.properties().items() if not isinstance(v, db.ReferenceProperty)]

'''
only non reference properties are saved in this method 
''' 
            
"""""""""
models
"""""""""
class Customer(db.Model):
    firstName = db.StringProperty()
    lastname = db.StringProperty()
    contact = db.StringProperty()
    address = db.StringProperty()
    
''' vechile search is the entry point
    of the system, all related info is
    abtained via vechile rego number '''
class Vechile(db.Model):
    rego = db.StringProperty()
    make = db.StringProperty()
    model = db.StringProperty()
    odometer = db.IntegerProperty()
    transmission = db.StringProperty()
    year = db.StringProperty()
    engineSize = db.FloatProperty()
    fuleType = db.StringProperty()
    bodyType = db.StringProperty()
    driveType = db.StringProperty()
    turbo = db.StringProperty()
    color = db.StringProperty()
    owner = db.ReferenceProperty(Customer)

class EntityCollectionRequest(webapp2.RequestHandler):
    def get(self):        
        model = eval(self.request.get('model'))        
        entity = EntityRequest.getEntityFromRequest(model, self.request)
        
        if entity:
            itemModelName = self.request.get('itemModelName')  
            items = getattr(entity, itemModelName.lower() + '_set')().get()
        else:pass            
            
        self.response.out.write(json.dumps([{"a":"b"},
                                            {"c":"d"}]));
        
        
        
 
''' invoice links to customer, vechile and invoice items.
    use refereceProperty back reference to check invoice 
    history of a particular vechile 
    invice key is to group invoice items '''    
class Invoice(db.Model):    
    vechile = db.ReferenceProperty(Vechile)
    labour = db.FloatProperty()
    notes = db.TextProperty()
        
''' invoice items are grouped by invoice key '''
class InvoiceItem(db.Model):
    description = db.TextProperty()
    quantity = db.IntegerProperty()
    unitPrice = db.FloatProperty()
    invoice =db.ReferenceProperty(Invoice)


"""""""""""""""""
request handlers 
"""""""""""""""""
''' get: /invoice?id=12
post: customer=124&vechile=1413&labour=134&notes="sdfsd"
'''
class InvoiceRequest(webapp2.RequestHandler):
    def get(self):
        invoiceId = self.request.get('id')
        invoice = Invoice.get_by_id(invoiceId)            
    
    def post(self):    
        def saveInvoice():                                    
            invoiceItemIds = map(lambda id:Invoice.get_by_id(id), self.request.get_all('items'))
            
            if invoiceItemIds:
                ownerId = self.request.get('customer')
                vechileId = self.request.get('vechile')
                
                owner = Customer.get_by_id(ownerId)
                vechile = Vechile.get_by_id(vechileId)
                
                invoice = EntityRequest.buildEntityFromRequest(Invoice, self.request)                
                invoice.owner = owner
                invoice.vechile = vechile
                invoice.put()
                         
                for invoiceItem in invoiceItemIds:
                    invoiceItem.invoice = invoice
                    invoiceItem.put()
                                
        db.run_in_transaction(saveInvoice)



''' resouce: /entity?model=Customer&id=12 '''
class EntityRequest(webapp2.RequestHandler): 
    @staticmethod
    def getEntityFromRequest(model, request):        
        if not issubclass(model, db.Model):
            raise TypeError()
        if not isinstance(request, webapp2.Request):
            raise TypeError()
        
        # based on the type of query key to determine
        # how to query the entity i.e. by id or by keyname  
        queryIdData = json.loads(request.get('id'))
        for k, v in queryIdData.items():
            queryType = k
            queryValue = v
                   
        entity = getattr(model, 'get_by_' + queryType)(queryValue)
        
        return entity  
            
    @staticmethod
    def buildEntityFromRequest(model, request):
        if not issubclass(model, db.Model):
            raise TypeError()
        if not isinstance(request, webapp2.Request):
            raise TypeError()
       
        instance = model()
        
        fields = getNoneRefereceProperties(model);    
        for field in fields:
            value = request.get(field)
            if value:
                setattr(instance, field, request.get(field))        
        
        return instance
           
    def get(self): 
        model = eval(self.request.get('model'))                    
        entity = EntityRequest.getEntityFromRequest(model, self.request)
                
        # if entity is not found, then send model schema to
        # client to display fields views
        if not entity:
            fields = getNoneRefereceProperties(model)
            schema = dict((k, None) for k in fields)
            schema['reference'] = [{'name':'owner','keytype':'id','keyvalue':'123'}]
            self.response.out.write(json.dumps(schema))
        else:
            logging.info('entity found')
            
        
    def post(self):
        model = eval(self.request.get('model'))   
        requestPayload = json.loads(self.request.body)
        requestPayload['id'] = 1
        self.response.out.write(json.dumps(requestPayload))
#        entity = EntityRequest.buildEntityFromRequest(model, self.request)
#        entity.put() 

    def put(self):
        logging.info('put starting');

class Main(webapp2.RequestHandler):
    def get(self):
        template = jinja_environment.get_template('index.html')
        tplVals = {
            'title' : "Car",
            'year'  : datetime.datetime.now().year,
            'company' :   "my-compnay"        
        }
        
        self.response.out.write(template.render(tplVals))

class TestCollection(webapp2.RequestHandler):
    def get(self):
        response = json.dumps({"a1":None,"a2":None})
        self.response.out.write(response)
    
class debug(webapp2.RequestHandler):
    def get(self):
        self.response.out.write('gsdfsdfd');
        
class TestEntity(db.Model):
    p1 = db.StringProperty()
    
class Test(webapp2.RequestHandler):
    def get(self):
        t1 = TestEntity(key_name="start")
        t1.p1 = "in t1"
        
        t2 = TestEntity()
        t2.p1 = "in t2"
        
        t1.put()
        t2.put()
        
#        rt1keystr = str(TestEntity.get_by_key_name('start').key())
        self.response.out.write(t2.key().id_or_name())
        
app = webapp2.WSGIApplication([('/', Main),
                               ('/entity', EntityRequest),
                               ('/invoice', InvoiceRequest),
                               ('/entityCollection',EntityCollectionRequest),
                               ('/test', Test)],
                              debug=True)

def main():
    run_wsgi_app(app)

if __name__ == "__main__":
    main()
