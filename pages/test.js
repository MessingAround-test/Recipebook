import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Test.module.css'
import { useEffect, useState } from 'react'


// import Grid from '@mui/material/Grid'; // Grid version 1
import Button from '@mui/material/Button';

import * as React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';

const Item = styled(Paper)(({ theme }) => ({
    backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
    ...theme.typography.body2,
    padding: theme.spacing(1),
    textAlign: 'center',
    color: theme.palette.text.secondary,
}));




import { Toolbar } from './Toolbar'


import Router from 'next/router'



export default function test() {

    const [tables, setTables] = useState([{ "name": "asdasd" }, { "name": "asdasd" }, { "name": "asdasd" }])


    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            alert("please re-log in")
            Router.push("/login")
        }
    });

    const redirect = async function (page) {
        Router.push(page)
    };

    return (
        <>

            <Box sx={{ flexGrow: 1 }}>
                <Grid container spacing={2}>
                    {
                        tables.map((table) => {
                            return (
                            <Grid item xs={2}>
                                <Item>hi there....</Item>
                            </Grid>
                            )
                        })
                    }
                </Grid>
            </Box>
        </>
    )
}
