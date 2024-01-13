
import { secret } from "../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../lib/dbConnect'
import User from '../../models/User'
async function matchKeys(obj1, obj2) {
  console.log(obj2)
  let newObj = {}
  for (const [key, value] of Object.entries(obj1)) {
    for (const [matchKey, matchValue] of Object.entries(obj2)) {
      console.log(key + " : " + matchKey)
      if (key === matchKey){
        newObj[key] = matchValue
      } 
    }
    if (newObj[key] === undefined){
      newObj[key] = value
    }
  }
  console.log(newObj)
  return newObj
}


export default async function handler(req, res) {


  verify(req.query.EDGEtoken, secret, async function (err, decoded) {
    if (err) {
      res.status(400).json({ res: "error: " + String(err) })
    } else {
      if (req.method === "GET") {
        await dbConnect()

        console.log(decoded)
        let db_id = decoded.id
        let userData = await User.findOne({ id: db_id });
        if (userData === {}) {
          res.status(400).json({ res: "user not found, please relog" })
        } else {

          let userdataTemplate = { username: 'test', email: 'test', test123: "asd"}
          console.log(userData)
          let newobj = {}
          // let newObj = matchKeys(userdataTemplate, userData)
          for (let key in userData){
            if (key in userdataTemplate){
              newobj[key] = userData[key]
            }
          }  
          
          for (let key in userdataTemplate){
            if (!(key in newobj)){
              newobj[key] = userdataTemplate[key]
              // console.log("hi there")
            }
          }  
          // const userData = { a: 'new value a', c: 'ignore c' };




          // Found USER
          res.status(200).json({ res: userData })
        }
      } else if (req.method === "PUT") {
        // console.log(req.body)
        try {
          let updateRes = User.findOneAndUpdate({ id: req.body._id }, { "$set": req.body })
          console.log(await updateRes)
          res.status(200).json({ success: true, res: "allgood" })
        } catch (error) {
          res.status(200).json({ success: false, res: "allgood", message: "ERROR" + String(error) })
        }

      } else {
        res.status(400).json({ res: "Not supported function" })
      }
    }
  });





}
