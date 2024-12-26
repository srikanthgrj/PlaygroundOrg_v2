trigger LoggerTag on LoggerTag__c(before insert, before update, before delete, after insert, after update, after delete, after undelete) {
  LoggerSObjectHandler.getHandler(Schema.LoggerTag__c.SObjectType, new LoggerTagHandler()).execute();
}