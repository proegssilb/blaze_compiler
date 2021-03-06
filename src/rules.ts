/*
    For loading and validating schema in JSON and YAML
*/

/// <reference path="../types/js-yaml.d.ts" />
/// <reference path="../types/node.d.ts" />
/// <reference path="../types/tv4.d.ts" />
/// <reference path="../src/expression.ts" />

import fs = require("fs");
import js_yaml = require("js-yaml");
import tv4 = require('tv4');
import expression = require('../src/expression');
import schema = require('../src/schema');
import path = require('path');

/**
 * synchronously loads a file resource, converting from YAML to JSON
 * @param filepath location on filesystem
 */
export function load_yaml(filepath:string):any{
    var json = fs.readFileSync(filepath, {encoding: 'utf8'}).toString();
    return js_yaml.load(json, 'utf8');
}

/**
 * synchronously loads a file resource, converting from multi document YAML to a callback with a JSON param
 */
export function load_yaml_collection(filepath:string, cb:(doc: any) => any):void{
    var json = fs.readFileSync(filepath, {encoding: 'utf8'}).toString();
    js_yaml.loadAll(json, cb,'utf8');
}

export var root:string = path.dirname(fs.realpathSync(__filename)) + "/../";
export var rules_schema:string = load_yaml(root + "schema/security_rules.yaml");

export function validate_rules(rules:string):boolean{
    tv4.addSchema("http://firebase.com/schema/types/object#", this.load_yaml(root + "schema/types/object.yaml"));
    tv4.addSchema("http://firebase.com/schema/types/string#", this.load_yaml(root + "schema/types/string.yaml"));
    tv4.addSchema("http://firebase.com/schema/types/boolean#",this.load_yaml(root + "schema/types/boolean.yaml"));
    tv4.addSchema("http://firebase.com/schema/types/number#", this.load_yaml(root + "schema/types/number.yaml"));
    tv4.addSchema("http://firebase.com/schema/types/any#",    this.load_yaml(root + "schema/types/any.yaml"));

    tv4.addSchema("http://firebase.com/schema#", this.load_yaml(root + "schema/schema.yaml"));
    tv4.addSchema("http://json-schema.org/draft-04/schema#", fs.readFileSync(root + "schema/jsonschema", {encoding: 'utf8'}).toString());

    var valid =  tv4.validate(rules, this.rules_schema, true, true);
    console.log("result", tv4.error);
    if(!valid){
        console.log(tv4.error)
    }

    if(tv4.getMissingUris().length != 0){
        console.log(tv4.getMissingUris());
        return false;
    }

    return valid;
}

export class SchemaRoot{
    json:any;
    root:schema.SchemaNode;

    constructor(json:any){
        this.json = json;
    }
    static parse(json:any):SchemaRoot{
        var schema = new SchemaRoot(json);
        return schema
    }
}


export class AccessEntry{
    location: string[]; //components of address, e.g. users/$userid is mapped to ['users', '$userid']
    read:     expression.Expression = expression.Expression.parse("false");
    write:    expression.Expression = expression.Expression.parse("false");

    static parse(json:any): AccessEntry{
        //console.log("AccessEntry.parse:", json);

        var accessEntry = new AccessEntry();
        accessEntry.location = json.location.split("/");

        //deal with issue of "/*" being split to "['', '*']" by removing first element
        while (accessEntry.location[0] === ''){
            accessEntry.location.shift();
        }

        if (accessEntry.location[accessEntry.location.length-1] == "") {
            accessEntry.location.pop()
        }

        if (json.read){
            accessEntry.read     = expression.Expression.parse(<string>json.read);
        }
        if (json.write){
            accessEntry.write    = expression.Expression.parse(<string>json.write);
        }

        //console.log("accessEntry.location", accessEntry.location);
        return accessEntry
    }

    match(location:string[]):boolean{
        //console.log("checking if ", location, " matches ", this.location);
        //candidate location must be at least as specific as this location
        if(this.location.length > location.length) return false;

        for(var idx in this.location){
            if(this.location[idx] !== location[idx]) return false
        }
        //console.log("access entry is applicable");
        return true;
    }
}

export class Access{
    [index: number]: AccessEntry;

    static parse(json:any):Access{

        //console.log("Access.parse:", json);
        var access = new Access();

        for(var index in json){
            var accessEntry = AccessEntry.parse(json[index]);
            access[index] = accessEntry;
        }
        return access
    }
}

export class Rules{
    predicates: expression.Predicates;
    schema:     SchemaRoot;
    access:     Access;

    static parse(json:any):Rules{
        var rules = new Rules();
        rules.predicates = expression.Predicates.parse(json.predicates);
        rules.schema     = SchemaRoot.parse(json.schema);
        rules.access     = Access.parse(json.access);
        return rules
    }
}