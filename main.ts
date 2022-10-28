import { getQuery } from "https://deno.land/x/oak@v11.1.0/helpers.ts";
import { Application, Router } from "https://deno.land/x/oak@v11.1.0/mod.ts";

import {
  ObjectId,
  MongoClient,
} from "https://deno.land/x/mongo@v0.31.1/mod.ts";

type Coche ={
    id: string;
    matricula: string;
    num_plazas: number;
    status: string;
};

type CocheSchema = Omit<Coche, "id"> & { _id: ObjectId }; // en la base de datos no se guarda el id, se guarda el _id

const client = new MongoClient();
await client.connect(
"mongodb+srv://Database_smarcosc:Database12@cluster0.r4chzbf.mongodb.net/?authMechanism=SCRAM-SHA-1",
);
const db = client.database("Database_smarcosc");
console.log("Connected to DB");

const router = new Router();

//addCar - Permite añadir un coche a la base de datos. Devuelve los datos del coche añadido. Debe comprobar que no existe ya un coche con la misma matrícula.
router
.post("/addCar", async (context) => {
    const result=context.request.body({type:"json"});
    const value = await result.value; 
    //comprueba que no existe ya un coche con la misma matrícula
    if(value.matricula===db.collection<CocheSchema>("coches").findOne({matricula:value.matricula.toString()})){
        context.response.status = 400;
        return;
    }else{
    const coche: Coche = {
        id: value._id,
        matricula: value.matricula,
        num_plazas: value.num_plazas,
        status: value.status,
    };
    const cocheId = await db.collection<CocheSchema>("coches").insertOne(coche);
    coche.id = cocheId.toString();
    context.response.body = coche;
    context.response.status = 200;
}
})
///car/:id - Devuelve la información de un coche, incluyendo el status (ocupado o libre)
.get("/car/:id", async (context) => {
    const id = context.params.id;
    if (!id) {
        context.response.status = 400;
        return;
    }
    const coche = await db.collection<CocheSchema>("coches").findOne({_id: new ObjectId(id) });
    if (coche) {
        context.response.body = coche;
        context.response.status = 200;
    } else {
        context.response.body = { message: "Coche not found" };
        context.response.status = 404;
    }
})
.get("/car", async (context) => {
    const coches = await db.collection<CocheSchema>("coches").find({}).toArray();
    context.response.body = coches;
})
///removeCar/:id - Permite eliminar un coche por id.Si el coche existe y no está ocupado devuelve un 200,si no existe devuelve un 404.Si existe, pero está ocupado devuelve un 405.
.delete("/removeCar/:id", async (context) => {
        const id = context.params.id;
        if (!id) {
            context.response.status = 404;
            return;
        }
        const coche = await db.collection<CocheSchema>("coches").findOne({ _id: new ObjectId(id) });
        if (coche) {
            if (coche.status === "ocupado") {
                context.response.status = 405;
            } else {
                await db.collection<CocheSchema>("coches").deleteOne({ _id: new ObjectId(id) });
                context.response.status = 200;
            }
        } else {
            context.response.status = 404;
        }
    }
)
//askCar - Sirve para reservar un coche. Pone el status del coche a ocupado.Si hay coches libres devuelve el id del coche. si no hay coches libres devuelve un 404 y un mensaje indicando que no hay coches.
.put("/askCar", async (context) => {
        const coche = await db.collection<CocheSchema>("coches").findOne({ status: "libre" });
        if (coche) {
            await db.collection<CocheSchema>("coches").updateOne(
                { _id: coche._id },
                { $set: { status: "ocupado" } },
            );
            context.response.body = { id: coche._id.toString() };
            context.response.status = 200;
        } else {
            context.response.body = { message: "No hay coches libres" };
            context.response.status = 404;
        }
    }
)

//releaseCar/:id - Sirve para liberar el coche por id.Si el id no existe devuelve un 404,si existe, pero no estaba ocupado devuelve un 400.Si existe y está ocupado lo libera y devuelve un 200
.put("/releaseCar/:id", async (context) => {
    const id = context.params.id;
    if (!id) {
        context.response.status = 404;
        return;
    }
    const coche = await db.collection<CocheSchema>("coches").findOne({ _id: new ObjectId(id) });
    if (coche) {
        if (coche.status === "ocupado") {
            await db.collection<CocheSchema>("coches").updateOne(
                { _id: new ObjectId(id) },
                { $set: { status: "libre" } },
            );
            context.response.status = 200;
        } else {
            context.response.status = 400;
        }
    } else {
        context.response.status = 404;
    }
});


const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 7777 });