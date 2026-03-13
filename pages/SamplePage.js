import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import Head from 'next/head';
import IngredientResearchComponent from '../components/IngredientResearchComponent';

function SamplePage() {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Searching for:", searchTerm);
  };

  return (
    <div className="min-h-screen bg-background">
      <Head>
        <title>Ingredient Explorer</title>
        <meta name="description" content="Explore a world of ingredients for your culinary and brewing adventures." />
        <link rel="icon" href="/avo.ico" />
      </Head>

      <main className="flex flex-col items-center justify-center p-4">
        <Card className="p-4 max-w-[95%] mx-auto rounded-[10px] shadow-[0_8px_16px_rgba(0,0,0,0.2)]">
          <CardHeader>
            <CardTitle className="text-center mb-4 text-[#007bff] text-2xl font-bold">
              Ingredient Explorer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground mb-4 text-sm">
              Check out how much shit costs at either, &quot;Woolworths&quot;, &quot;Aldi&quot;, &quot;Panetta&quot; or &quot;IGA&quot;.
              First one to try is &quot;Carrot&quot;
              <br></br>
              You are restricted to only the ones which have already been searched unless bryn gives you an account.
            </p>

            {/* Render Ingredient Research Component */}
            <div className="mt-4">
              <IngredientResearchComponent />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default SamplePage;
