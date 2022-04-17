
import { secret } from "../../lib/dbsecret"
import { verify } from "jsonwebtoken";
import dbConnect from '../../lib/dbConnect'
import User from '../../models/User'
import Recipe from '../../models/Recipe'


export default async function handler(req, res) {


  verify(req.query.EDGEtoken, secret, async function (err, decoded) {
    if (err) {
      res.status(400).json({ res: "error: " + String(err) })
    } else {
      if (req.method === "GET") {
        
        await dbConnect()

        console.log(decoded)
        var db_id = decoded.id
        var userData = await User.findOne({ id: db_id });
        if (userData === {}) {
          res.status(400).json({ res: "user not found, please relog" })
        } else {

          var RecipeData = await Recipe.find({})
          res.status(200).json({ res: RecipeData})
        }
      } else if (req.method === "POST") {
        // console.log(req.body)
        try {
        await dbConnect()
        console.log(req.query)
        console.log(req.body)
        const response = Recipe.create({
          creator_username: "BRYN",
          creator_email: "BRYN",
          ingredients : req.body.ingreds,
          instructions: req.body.instructions,
          image: req.body.image,
          name: req.body.name
      });
      console.log(await response);

        res.status(200).json({success: true, data: [], message: "Allgood"})
      } catch (error)  {
        res.status(400).json({success: false, data: [], message: String(error)})
      }
      } else {
        res.status(400).json({ success: false, data: [], message: "Not supported request"})
      }
    }
  });





}
