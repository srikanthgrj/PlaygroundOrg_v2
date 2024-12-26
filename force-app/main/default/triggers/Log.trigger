trigger Log on Log__c(before insert, before update, before delete, after insert, after update, after delete, after undelete) {
  LoggerSObjectHandler.getHandler(Schema.Log__c.SObjectType, new LogHandler()).execute();
}